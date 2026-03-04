import { describe, it, expect } from 'vitest'
import { reducer } from './cart'

describe('Cart Reducer Logic', () => {

    it('should add a new item to the cart', () => {
        const initialState: any[] = []
        const product = { id: 1, title: 'Test Product', price: 100 }
        
        const newState = reducer(initialState, {
            type: 'ADD_TO_CART',
            payload: product
        })

        expect(newState).toHaveLength(1)
        expect(newState[0].id).toBe(1)
        expect(newState[0].quantity).toBe(1)
    })

    it('should increment quantity if item exists', () => {
        const initialState = [{ id: 1, title: 'Test Product', price: 100, quantity: 1 }]
        const product = { id: 1 }
        
        const newState = reducer(initialState, {
            type: 'ADD_TO_CART',
            payload: product
        })

        expect(newState).toHaveLength(1)
        expect(newState[0].quantity).toBe(2)
    })

    it('should remove an item from the cart', () => {
        const initialState = [{ id: 1, title: 'Test Product', price: 100, quantity: 1 }]
        
        const newState = reducer(initialState, {
            type: 'REMOVE_FROM_CART',
            payload: { id: 1 }
        })

        expect(newState).toHaveLength(0)
    })

    it('should clear the cart', () => {
        const initialState = [
            { id: 1, quantity: 1 },
            { id: 2, quantity: 5 }
        ]
        
        const newState = reducer(initialState, { type: 'CLEAR_CART', payload: {} })

        expect(newState).toHaveLength(0)
    })
})
