import { ListaLocal } from './lista-local'

export const metadata = { title: 'Mis solicitudes · AquíVe' }

export default function MisSolicitudesPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-2xl font-bold">Mis solicitudes</h1>
      <p className="mt-2 text-base text-muted-foreground">
        Guardadas solo en este teléfono. Si cambias de teléfono o borras los
        datos del navegador, se pierden: no las tenemos guardadas en ningún
        lado.
      </p>
      <ListaLocal />
    </main>
  )
}
