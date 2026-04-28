import { useState, useEffect } from 'react'
import { useUser } from '../context/user'
import { api } from '../services/api'

type Step = 'IDLE' | 'EMAIL_GATE' | 'PHONE_INPUT' | 'OTP_INPUT' | 'SUCCESS'

const PHONE_REGEX = /^\+54 9 \d{4} \d{4}$/

export default function SellerOnboarding() {
  const { user, upgradeToSeller } = useUser()
  const [step, setStep] = useState<Step>('IDLE')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(60)

  useEffect(() => {
    if (step !== 'OTP_INPUT' || secondsLeft === 0) return
    const id = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(id)
  }, [step, secondsLeft])

  if (!user || user.role !== 'user') return null

  function handleWantToSell() {
    if (!user!.is_email_verified) {
      setStep('EMAIL_GATE')
    } else {
      setStep('PHONE_INPUT')
    }
  }

  async function handleRequestOtp() {
    if (!PHONE_REGEX.test(phone)) {
      setError('Formato inválido. Usá +54 9 XXXX XXXX')
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.post('/api/seller/request-otp', { phone })
      setStep('OTP_INPUT')
      setSecondsLeft(60)
    } catch (e: any) {
      setError(e.response?.data?.message || 'Error al enviar el código')
    } finally {
      setLoading(false)
    }
  }

  async function handleResendOtp() {
    setError('')
    setLoading(true)
    try {
      await api.post('/api/seller/request-otp', { phone })
      setSecondsLeft(60)
    } catch (e: any) {
      setError(e.response?.data?.message || 'Error al reenviar el código')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp() {
    if (code.length !== 6) {
      setError('Ingresá los 6 dígitos del código')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/api/seller/verify-otp', { phone, code })
      upgradeToSeller(res.data.token, res.data.data)
      setStep('SUCCESS')
    } catch (e: any) {
      setError(e.response?.data?.message || 'Código incorrecto o expirado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold mb-3">Activar cuenta de vendedor</h3>

      {step === 'IDLE' && (
        <button
          onClick={handleWantToSell}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Quiero vender
        </button>
      )}

      {step === 'EMAIL_GATE' && (
        <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 text-sm">
          Necesitás verificar tu email antes de activar tu cuenta de vendedor.
        </p>
      )}

      {step === 'PHONE_INPUT' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Ingresá tu número de WhatsApp para recibir el código de verificación.
          </p>
          <div>
            <input
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setError('') }}
              placeholder="+54 9 XXXX XXXX"
              className={`w-full border rounded px-3 py-2 text-sm ${
                phone && !PHONE_REGEX.test(phone) ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {phone && !PHONE_REGEX.test(phone) && (
              <p className="text-xs text-red-500 mt-1">Formato: +54 9 XXXX XXXX</p>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={handleRequestOtp}
            disabled={loading || !PHONE_REGEX.test(phone)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? 'Enviando...' : 'Enviar código'}
          </button>
        </div>
      )}

      {step === 'OTP_INPUT' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Ingresá el código de 6 dígitos que enviamos a tu WhatsApp.
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError('') }}
            placeholder="123456"
            className="w-32 border border-gray-300 rounded px-3 py-2 text-center text-lg tracking-widest"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 items-center">
            <button
              onClick={handleVerifyOtp}
              disabled={loading || code.length !== 6}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? 'Verificando...' : 'Verificar código'}
            </button>
            <button
              onClick={handleResendOtp}
              disabled={secondsLeft > 0 || loading}
              className="text-sm text-blue-600 hover:underline disabled:opacity-40 disabled:no-underline"
            >
              {secondsLeft > 0 ? `Reenviar en ${secondsLeft}s` : 'Reenviar código'}
            </button>
          </div>
        </div>
      )}

      {step === 'SUCCESS' && (
        <div className="space-y-3">
          <p className="text-green-700 font-medium">
            ¡Perfil de vendedor activado! Ya podés publicar cartas.
          </p>
          <a
            href="/publicar"
            className="inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            Ir a publicar
          </a>
        </div>
      )}
    </div>
  )
}
