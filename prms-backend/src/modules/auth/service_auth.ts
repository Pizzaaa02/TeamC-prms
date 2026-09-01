import bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../db';
import { env } from '../../config';

export async function registerUser(email: string, password: string, full_name?: string, phone?: string, role?: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('Email already registered');

  const passwordHash = await bcrypt.hash(password, 10);
  // firebase_uid is a unique column; password-based accounts have no real
  // Firebase identity, so a per-user placeholder avoids collisions between
  // otherwise-unrelated accounts (was hardcoded to "" which only allowed a
  // single password-based registration to ever succeed).
  const firebase_uid = `local-${uuidv4()}`;

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firebase_uid,
      full_name,
      phone,
      UserRole: {
        create: {
          role: { connect: { name: role || 'Tenant' } }
        }
      }
    },
    include: { UserRole: { include: { role: true } } },
  });

  return user;
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { UserRole: { include: { role: true } } },
  });

  if (!user) throw new Error('Email not registered');
  if (!user.passwordHash) throw new Error('Please use Firebase login for this account');
  if (!user.is_active) throw new Error('Account is suspended');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error('Wrong password. Please try again.');

  return user;
}

export function generateTokens(userId: string) {
  const accessToken = jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRY } as jwt.SignOptions);
  const refreshToken = jwt.sign({ userId }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRY, jwtid: randomUUID() } as jwt.SignOptions);
  return { accessToken, refreshToken };
}

export async function saveRefreshToken(userId: string, refreshToken: string) {
  // JWTs exceed bcrypt's 72-byte limit. Hash the entire token before bcrypt.
  const hash = await bcrypt.hash(createHash('sha256').update(refreshToken).digest('hex'), 10);
  await prisma.user.update({ where: { id: userId }, data: { refreshToken: hash } });
}

export async function verifyRefreshToken(userId: string, refreshToken: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.refreshToken) throw new Error('No refresh token found');
  if (!user.is_active) throw new Error('Account is suspended');
  const valid = await bcrypt.compare(createHash('sha256').update(refreshToken).digest('hex'), user.refreshToken);
  if (!valid) throw new Error('Invalid refresh token');
  return user;
}

export async function getCurrentUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, full_name: true, phone: true,
      profile_img_url: true, firebase_uid: true, is_active: true, created_at: true,
      UserRole: { include: { role: true } },
    },
  });
}

// Roles a user may assign to themselves (e.g. during first-time onboarding).
// 'Admin' is deliberately excluded — granting Admin must never be something
// a user can trigger on their own account through a self-service endpoint.
const SELF_SERVICE_ROLES = ['Tenant', 'Landlord', 'Agent'];

export async function updateUserProfile(
  userId: string,
  data: { full_name?: string; phone?: string; profile_img_url?: string; role?: string }
) {
  // If role is provided, update the UserRole association
  if (data.role) {
    if (!SELF_SERVICE_ROLES.includes(data.role)) {
      throw new Error(`Role ${data.role} cannot be self-assigned`);
    }
    const role = await prisma.role.findUnique({ where: { name: data.role } });
    if (!role) throw new Error(`Role ${data.role} not found`);
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      update: {},
      create: { userId, roleId: role.id },
    });
  }

  const { role, ...userFields } = data;
  return prisma.user.update({
    where: { id: userId },
    data: userFields,
    // passwordHash/refreshToken must never leave the API — select instead of include.
    select: {
      id: true, email: true, full_name: true, phone: true,
      profile_img_url: true, firebase_uid: true, is_active: true, created_at: true,
      UserRole: { include: { role: true } },
    },
  });
}

export async function logoutUser(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash) throw new Error('Password-based account required');

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new Error('Current password is incorrect');

  const newHash = await bcrypt.hash(newPassword, 10);
  return prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash },
  });
}
