import {Router} from 'express';
import {  findAll, findOne, add, update,remove } from './itemCarta.controler.js';


export const itemCartaRouter = Router();

itemCartaRouter.get('/', findAll);
itemCartaRouter.get('/:id', findOne);
itemCartaRouter.post('/',  add);
itemCartaRouter.put('/:id',  update);
itemCartaRouter.delete('/:id', remove);
