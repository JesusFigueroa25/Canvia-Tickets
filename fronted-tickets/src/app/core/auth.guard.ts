import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserService } from '../services/user.service';

export const authGuard: CanActivateFn = () => {

  const userService = inject(UserService);
  const router = inject(Router);

  if (userService.sesionValida()) {
    return true;
  }

  return router.createUrlTree(['/']);

};


export const guestGuard: CanActivateFn = () => {

  const userService = inject(UserService);
  const router = inject(Router);

  if (userService.sesionValida()) {
    return router.createUrlTree(['/home']);
  }

  return true;

};