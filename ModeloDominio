```mermaid
classDiagram
class Usuario {
        +String id
        +String nombre
        +String email
        +String contraseña
    }

    class Carta {
        +String id
        +String nombre
        +String descripcion
        +Float precio
        +String estado
        +String ciudad
        +Date fechaPublicacion
    }

    class Reserva {
        +String id
        +Date fecha
        +int cantidad
        +String estado
    }

    class Pedido {
        +String id
        +Date fechaCreacion
        +String estado
    }

    class Envio {
        +String id
        +String direccionDestino
        +Date fechaSalida
        +Date fechaEntrega
        +String estado
    }

    class Intermediario {
        +String id
        +String nombre
        +String email
        +String telefono
        +String ciudadAsignada
    }

    class Direccion {
        +String id
        +String calle
        +String numero
        +String ciudad
        +String codigoPostal
    }

    class Valoracion {
        +String id
        +int puntaje
        +String comentario
        +Date fecha
    }

    Usuario "1" --> "0..*" Carta : publica
    Usuario "1" --> "0..*" Reserva : hace
    Usuario "1" --> "0..*" Valoracion : realiza
    Usuario "1" --> "1..*" Direccion : tiene

    Intermediario "1" --> "0..*" Pedido : gestiona
    Intermediario "1" --> "1" Direccion : tiene

    Carta "1" --> "0..*" Reserva : esReservadaEn
    Reserva "1" --> "1" Pedido : perteneceA
    Pedido "1" --> "1" Envio : tiene
    Pedido "1" --> "0..*" Reserva : agrupa

    Valoracion "1" --> "1" Intermediario : sobre
```
