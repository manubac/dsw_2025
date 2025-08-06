import express, {NextFunction, Request, Response} from 'express' 
import { cartaRouter } from './carta/carta.routes.js'

const app = express()
app.use(express.json())


app.use('/api/cartas', cartaRouter)


app.use((_, res) => {
  return res.status(404).send({ message: 'Resource not found' })
})

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000')
})