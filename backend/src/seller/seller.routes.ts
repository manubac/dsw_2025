import { Router } from 'express';
import { authenticate, authorizeRoles } from '../shared/middleware/auth.js';
import { requestOtp, verifyOtp, sanitizeRequestOtp, sanitizeVerifyOtp } from './seller.controler.js';

export const sellerRouter = Router();

sellerRouter.post('/request-otp', authenticate, authorizeRoles('user'), sanitizeRequestOtp, requestOtp);
sellerRouter.post('/verify-otp',  authenticate, authorizeRoles('user'), sanitizeVerifyOtp,  verifyOtp);
