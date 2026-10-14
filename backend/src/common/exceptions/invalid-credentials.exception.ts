import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

export class InvalidCredentialsException extends DomainException {
  constructor() {
    super(
      'Invalid credentials',
      HttpStatus.UNAUTHORIZED,
      'INVALID_CREDENTIALS',
    );
  }
}

export class IncorrectEmailException extends DomainException {
  constructor() {
    super('Email is incorrect', HttpStatus.UNAUTHORIZED, 'INCORRECT_EMAIL');
  }
}

export class IncorrectPasswordException extends DomainException {
  constructor() {
    super(
      'Password is incorrect',
      HttpStatus.UNAUTHORIZED,
      'INCORRECT_PASSWORD',
    );
  }
}

export class AccountInactiveException extends DomainException {
  constructor() {
    super('This account is inactive', HttpStatus.FORBIDDEN, 'ACCOUNT_INACTIVE');
  }
}

export class PasswordSignInUnavailableException extends DomainException {
  constructor() {
    super(
      'Password sign-in is unavailable. Use your connected sign-in provider.',
      HttpStatus.UNAUTHORIZED,
      'PASSWORD_SIGN_IN_UNAVAILABLE',
    );
  }
}
