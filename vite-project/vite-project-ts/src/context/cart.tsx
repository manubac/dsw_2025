import React, { createContext, useReducer } from 'react'

export const CartContext = createContext<any>(null)

const initialState: any[] = []

const reducer = (state: any[], action: any) => {
    const { type: actionType, payload: actionPayload } = action
    switch (actionType) {
        case 'ADD_TO_CART': {
            const { id } = actionPayload
            const productInCartIndex = state.findIndex(item => item.id === id)

            if (productInCartIndex >= 0) {
                const newState = [
                    ...state.slice(0, productInCartIndex),
                    { ...state[productInCartIndex], quantity: state[productInCartIndex].quantity + 1 },
                    ...state.slice(productInCartIndex + 1)
                ]
                return newState
            }

            return [
                ...state,
                {
                    ...actionPayload,
                    quantity: 1
                }
            ]
        }
        case 'DECREASE_FROM_CART': {
            const { id } = actionPayload
            const productInCartIndex = state.findIndex(item => item.id === id)

            if (productInCartIndex >= 0) {
                if (state[productInCartIndex].quantity > 1) {
                    const newState = [
                        ...state.slice(0, productInCartIndex),
                        { ...state[productInCartIndex], quantity: state[productInCartIndex].quantity - 1 },
                        ...state.slice(productInCartIndex + 1)
                    ]
                    return newState
                }
                return state.filter(item => item.id !== id)
            }
            return state
        }
        case 'REMOVE_FROM_CART': {
            const { id } = actionPayload
            return state.filter(item => item.id !== id)
        }
        case 'CLEAR_CART': {
            return initialState
        }
    }
    return state
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const addToCart = (product: any) => dispatch({
    type: 'ADD_TO_CART',
    payload: product
  })

  const decreaseFromCart = (product: any) => dispatch({
    type: 'DECREASE_FROM_CART',
    payload: product
  })

  const removeFromCart = (product: any) => dispatch({
    type: 'REMOVE_FROM_CART',
    payload: product
  })

  const clearCart = () => dispatch({ type: 'CLEAR_CART' })

  return (
    <CartContext.Provider value={{ cart: state, addToCart, removeFromCart, clearCart, decreaseFromCart }}>
      {children}
    </CartContext.Provider>
  )
}
