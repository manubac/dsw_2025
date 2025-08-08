import express, {NextFunction, Request, Response} from 'express' 
import { vendedorRouter } from './vendedor/vendedor.routes.js';
import { cartaRouter } from './carta/carta.routes.js'

const app = express()
app.use(express.json())

app.use('/api/vendedores', vendedorRouter);
app.use('/api/cartas', cartaRouter)

app.use((req, res)=> {
    res.status(404).send({message:'Ruta no encontrada'});
})

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
})
