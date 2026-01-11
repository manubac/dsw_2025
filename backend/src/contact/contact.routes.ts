import { Router } from 'express';
import { sendContactEmail } from './contact.controller.js';

export const contactRouter = Router();

contactRouter.post('/', sendContactEmail);
