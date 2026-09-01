export function googleAuthErrorMessage(error) {
  switch (error?.code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled. Please try again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.';
    case 'auth/unauthorized-domain':
      return 'This website address is not authorized for Google sign-in. Ask the project owner to add it to Firebase Authentication authorized domains.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled in Firebase. Ask the project owner to enable the Google provider.';
    case 'auth/network-request-failed':
      return 'Google sign-in could not connect. Check your internet connection and try again.';
    default:
      return `Google sign-in failed${error?.code ? ` (${error.code})` : ''}. Please try again.`;
  }
}
