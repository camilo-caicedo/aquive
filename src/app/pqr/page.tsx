import type { Metadata } from 'next'

import { FormularioPqr } from './formulario-pqr'

export const metadata: Metadata = {
  title: 'Peticiones, quejas y reclamos',
  description:
    'Pon una petición, queja, reclamo o sugerencia sin cuenta. Respondemos en los plazos de la Ley 1581 de 2012.',
}

export default function PqrPage() {
  return <FormularioPqr />
}
