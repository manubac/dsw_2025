import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '../context/user'
import { api } from '../services/api'

interface PendingSellerData {
  id: number
  nombre: string
  telefono: string
  [key: string]: unknown
}

type Step = 'IDLE' | 'EMAIL_GATE' | 'PHONE_INPUT' | 'OTP_INPUT' | 'PAYMENT_INFO' | 'SUCCESS'

const PHONE_REGEX = /^\+54 9 \d{4} \d{4}$/
const CBU_REGEX   = /^\d{22}$/
const ALIAS_REGEX = /^[a-zA-Z0-9.]{6,20}$/

export default function SellerOnboarding() {
  const { user, upgradeToSeller } = useUser()
  const [step, setStep]           = useState<Step>('IDLE')
  const [phone, setPhone]         = useState('')
  const [code, setCode]           = useState('')
  const [cbu, setCbu]             = useState('')
  const [alias, setAlias]         = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(60)

  const [pendingVendedorId, setPendingVendedorId] = useState<number | null>(null)
  const [pendingToken, setPendingToken]             = useState<string>('')
  const [pendingData, setPendingData]               = useState<PendingSellerData | null>(null)

  useEffect(() => {
    if (step !== 'OTP_INPUT' || secondsLeft === 0) return
    const id = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(id)
  }, [step, secondsLeft])

  if (!user) return null
  if (user.role !== 'user' && step !== 'PAYMENT_INFO' && step !== 'SUCCESS') return null

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
      setPendingVendedorId(res.data.data.id)
      setPendingToken(res.data.token)
      setPendingData(res.data.data)
      setStep('PAYMENT_INFO')
    } catch (e: any) {
      setError(e.response?.data?.message || 'Código incorrecto o expirado')
    } finally {
      setLoading(false)
    }
  }

  async function handleSavePaymentInfo() {
    if (!CBU_REGEX.test(cbu)) {
      setError('El CBU debe tener exactamente 22 dígitos numéricos')
      return
    }
    if (!ALIAS_REGEX.test(alias)) {
      setError('El alias debe tener entre 6 y 20 caracteres (letras, números y puntos)')
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.patch(
        `/api/vendedores/${pendingVendedorId}`,
        { cbu, alias },
        { headers: { Authorization: `Bearer ${pendingToken}` } }
      )
      upgradeToSeller(pendingToken, { ...pendingData, cbu, alias })
      setStep('SUCCESS')
    } catch (e: any) {
      setError(e.response?.data?.message || 'Error al guardar datos de pago')
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

      {step === 'PAYMENT_INFO' && (
        <div className="space-y-3">
          <p className="text-sm text-green-700 font-medium">
            ¡Teléfono verificado! Ingresá tus datos de cobro para completar el registro.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">CBU (22 dígitos)</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={22}
              value={cbu}
              onChange={e => { setCbu(e.target.value.replace(/\D/g, '')); setError('') }}
              placeholder="0000000000000000000000"
              className={`w-full border rounded px-3 py-2 text-sm ${
                cbu && !CBU_REGEX.test(cbu) ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {cbu && !CBU_REGEX.test(cbu) && (
              <p className="text-xs text-red-500 mt-1">El CBU debe tener exactamente 22 dígitos</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Alias (6–20 caracteres)</label>
            <input
              type="text"
              value={alias}
              onChange={e => { setAlias(e.target.value); setError('') }}
              placeholder="mi.alias.pago"
              className={`w-full border rounded px-3 py-2 text-sm ${
                alias && !ALIAS_REGEX.test(alias) ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {alias && !ALIAS_REGEX.test(alias) && (
              <p className="text-xs text-red-500 mt-1">Solo letras, números y puntos (6–20 caracteres)</p>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={handleSavePaymentInfo}
            disabled={loading || !CBU_REGEX.test(cbu) || !ALIAS_REGEX.test(alias)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition"
          >
            {loading ? 'Guardando...' : 'Guardar y continuar'}
          </button>
        </div>
      )}

      {step === 'SUCCESS' && (
        <div className="space-y-3">
          <p className="text-green-700 font-medium">
            ¡Perfil de vendedor activado! Ya podés publicar cartas.
          </p>
          <Link
            to="/publicar"
            className="inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            Ir a publicar
          </Link>
        </div>
      )}
    </div>
  )
}
