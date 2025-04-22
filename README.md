#  Propuesta TP DSW
##  Integrantes

- **Triches Alan Facundo** - 49598  
- **Manuel Bacolla** - 50214  
- **Volentiera Nicolás** - 51824  
- **Bruno Leo Santi** - 51950

---

##  Tema

**Marketplace de Cartas de Pokémon**

---

##  Descripción

Es un marketplace especializado en la compra y distribución de cartas de Pokémon, donde tiendas oficiales agrupan pedidos de varios vendedores para enviarlos a otra tienda oficial.  
La plataforma optimiza la distribución de cartas, permitiendo a los minoristas obtener mejores precios y reducir costos de envío.

## Alcance Funcional

### Alcance Minimo


| Requerimiento         | Detalle                                                                                                                                              |
|-----------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|
| CRUD simple           | 1. CRUD Usuario <br> 2. CRUD Carta <br> 3. CRUD Vendedor <br> 4. CRUD Dirección                                                                         |
| CRUD dependiente      | 1. CRUD Reserva (depende de Usuario y Carta) <br> 2. CRUD Envío (opcional, entre usuarios)                                                      |
| Listado + detalle     | 1. Listado de cartas filtrado por nombre, código, etc. <br> 2. Detalle de reservas realizadas y ventas de un vendedor                     |
| CUU/Epic              | 1. Publicación de carta por parte del vendedor <br> 2. Reserva y compra de una carta por parte de un usuario                                       |

---


### Adicionales para Aprobación


| Requerimiento         | Detalle                                                                 |
|-----------------------|-------------------------------------------------------------------------|
| CRUD simple      | 1. CRUD Intermediario (vinculadas a pedidos o cartas)                    |
| CRUD dependiente      | 1. CRUD Valoración (depende de intermediario, usuario                                                   |
| CUU / Epic            | 1. Valorar una carta después de la compra<br>2. Asignar un envío a un intermediario para su distribución posterior |
