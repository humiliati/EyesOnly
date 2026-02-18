/* ============================================================
   EYES ONLY — Unified Authentication Button Component
   Context-aware button for LOGIN/REGISTER/LOGOUT/LOGGING IN
   ============================================================ */

import { h } from 'preact';

export type AuthState = 
  | 'authenticated'
  | 'unauthenticated'
  | 'sessionRestoring'
  | 'atLoginScreen'
  | 'atRegisterScreen'
  | 'registrationPending';

export interface AuthButtonProps {
  state: AuthState;
  onClick: () => void;
  customText?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Unified authentication button that changes text and behavior based on context.
 * 
 * State → Button Text → Action
 * - authenticated → LOGOUT → executeLogout()
 * - unauthenticated → LOGIN → navigateToLogin()
 * - atLoginScreen → REGISTER → navigateToRegister()
 * - atRegisterScreen → BACK TO LOGIN → navigateToLogin()
 * - sessionRestoring → LOGGING IN... → (disabled)
 * - registrationPending → COMPLETE REGISTRATION → submitRegistration()
 */
export function AuthButton({ 
  state, 
  onClick, 
  customText, 
  className = '', 
  disabled = false 
}: AuthButtonProps) {
  const buttonText = customText || getButtonText(state);
  const isDisabled = disabled || state === 'sessionRestoring';
  const ariaLabel = getAriaLabel(state);

  return (
    <button
      class={`auth-btn ${className}`}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={ariaLabel}
      data-auth-state={state}
    >
      {buttonText}
    </button>
  );
}

function getButtonText(state: AuthState): string {
  switch (state) {
    case 'authenticated':
      return 'LOGOUT';
    case 'atLoginScreen':
      return 'REGISTER';
    case 'atRegisterScreen':
      return 'BACK TO LOGIN';
    case 'sessionRestoring':
      return 'LOGGING IN...';
    case 'registrationPending':
      return 'COMPLETE REGISTRATION';
    case 'unauthenticated':
    default:
      return 'LOGIN';
  }
}

function getAriaLabel(state: AuthState): string {
  switch (state) {
    case 'authenticated':
      return 'Log out of current session';
    case 'atLoginScreen':
      return 'Navigate to registration';
    case 'atRegisterScreen':
      return 'Return to login screen';
    case 'sessionRestoring':
      return 'Restoring session, please wait';
    case 'registrationPending':
      return 'Complete account registration';
    case 'unauthenticated':
    default:
      return 'Log in to account';
  }
}
