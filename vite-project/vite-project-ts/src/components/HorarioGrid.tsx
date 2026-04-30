export type HorarioDia = {
  abre: string;
  cierra: string;
  cerrado: boolean;
};

export type HorarioSemanal = {
  lunes:     HorarioDia;
  martes:    HorarioDia;
  miercoles: HorarioDia;
  jueves:    HorarioDia;
  viernes:   HorarioDia;
  sabado:    HorarioDia;
  domingo:   HorarioDia;
};

export const HORARIO_DEFAULT: HorarioSemanal = {
  lunes:     { abre: '09:00', cierra: '18:00', cerrado: false },
  martes:    { abre: '09:00', cierra: '18:00', cerrado: false },
  miercoles: { abre: '09:00', cierra: '18:00', cerrado: false },
  jueves:    { abre: '09:00', cierra: '18:00', cerrado: false },
  viernes:   { abre: '09:00', cierra: '18:00', cerrado: false },
  sabado:    { abre: '10:00', cierra: '14:00', cerrado: false },
  domingo:   { abre: '00:00', cierra: '00:00', cerrado: true  },
};

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
type Dia = typeof DIAS[number];

const LABELS: Record<Dia, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
};

interface HorarioGridProps {
  value: HorarioSemanal;
  onChange: (h: HorarioSemanal) => void;
  disabled?: boolean;
}

export function HorarioGrid({ value, onChange, disabled = false }: HorarioGridProps) {
  function update(dia: Dia, field: 'abre' | 'cierra' | 'cerrado', val: string | boolean) {
    onChange({ ...value, [dia]: { ...value[dia], [field]: val } });
  }

  return (
    <div className="space-y-2">
      {DIAS.map(dia => (
        <div key={dia} className="flex items-center gap-3 text-sm flex-wrap">
          <span className="w-24 font-medium text-gray-700">{LABELS[dia]}</span>
          <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={value[dia].cerrado}
              onChange={e => update(dia, 'cerrado', e.target.checked)}
              disabled={disabled}
              className="accent-orange-500"
            />
            Cerrado
          </label>
          <input
            type="time"
            value={value[dia].abre}
            onChange={e => update(dia, 'abre', e.target.value)}
            disabled={disabled || value[dia].cerrado}
            className="border border-gray-300 rounded px-2 py-1 text-xs disabled:opacity-40 focus:outline-none focus:border-orange-400"
          />
          <span className="text-xs text-gray-400">–</span>
          <input
            type="time"
            value={value[dia].cierra}
            onChange={e => update(dia, 'cierra', e.target.value)}
            disabled={disabled || value[dia].cerrado}
            className="border border-gray-300 rounded px-2 py-1 text-xs disabled:opacity-40 focus:outline-none focus:border-orange-400"
          />
        </div>
      ))}
    </div>
  );
}
