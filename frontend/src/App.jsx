import { useState } from 'react'
import { PhoneFrame } from './components/PhoneFrame'
import { TabBar } from './components/TabBar'
import { Login } from './pages/Login'
import { Calendar } from './pages/Calendar'
import { MyReservations } from './pages/MyReservations'
import { Admin } from './pages/Admin'
import { useAuth } from './auth/AuthContext'

export default function App() {
  const { user, isAdmin } = useAuth()
  const [tab, setTab] = useState('cal')

  if (!user) {
    return (
      <PhoneFrame>
        <Login />
      </PhoneFrame>
    )
  }

  // The admin tab exists only for admins. The backend also enforces this, so
  // hiding it here is UX, not security.
  const tabs = [
    { key: 'cal', label: 'Takvim' },
    { key: 'mine', label: 'Rezervasyonlarım' },
  ]
  if (isAdmin) tabs.push({ key: 'admin', label: 'Rezervasyonlar' })

  const active = tabs.some((t) => t.key === tab) ? tab : 'cal'

  return (
    <PhoneFrame>
      {active === 'cal' && <Calendar />}
      {active === 'mine' && <MyReservations />}
      {active === 'admin' && <Admin />}
      <TabBar tabs={tabs} active={active} onSelect={setTab} />
    </PhoneFrame>
  )
}
