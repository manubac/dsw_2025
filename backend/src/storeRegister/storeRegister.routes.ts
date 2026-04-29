import { Router } from 'express';
import { validateToken, verifyEmail, verifyPhone, completeRegistration } from './storeRegister.controller.js';

export const storeRegisterRouter = Router();

storeRegisterRouter.get('/validate', validateToken);
storeRegisterRouter.post('/verify-email', verifyEmail);
storeRegisterRouter.post('/verify-phone', verifyPhone);
storeRegisterRouter.post('/complete', completeRegistration);
