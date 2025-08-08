import { Repository  } from '../shared/repository.js';
import { Vendedor } from './vendedores.entity.js';
const vendedores: Vendedor[] = [
    new Vendedor(
        'Manuel',
        'manubacolla@gmail.com',
        '1234567890',
        'f65faf70-18d4-4148-b592-e82aa756342d'
    ),
    new Vendedor(
        'Juan',
        'juangarcia@gmail.com',
        '0987654321',
        'ae24829e-ba22-4911-ae8a-9b77c805823c'
    ),
    new Vendedor(
        'Ana',
        'analopez@icloud.com',
        '1122334455',
        '2e987f7b-3115-4374-97bd-c22d35fa6caa'
    ),
];

export class VendedorRepository implements Repository<Vendedor> {
    public findAll(): Vendedor[] | undefined {
        return vendedores;
    }
    public findOne(item: {id: string}): Vendedor | undefined {
        return vendedores.find((vendedor) => vendedor.id === item.id)
    }
    public add(item: Vendedor): Vendedor | undefined {
        vendedores.push(item);
        return item;
    }
    public update(item: Vendedor): Vendedor | undefined {
        const vendedorIdx = vendedores.findIndex((vendedor) => vendedor.id === item.id);
        if (vendedorIdx !== -1) {
            vendedores[vendedorIdx] = {...vendedores[vendedorIdx], ...item};
            return vendedores[vendedorIdx];
        }
        return undefined;
    }
    public delete(item: {id: string}): Vendedor | undefined {
        const index = vendedores.findIndex((vendedor) => vendedor.id === item.id);
        if (index !== -1) {
            return vendedores.splice(index, 1)[0];
        }
        return undefined;
    }
}
