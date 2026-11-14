// Shared page frame: the scrolling content area plus the bottom navigation bar from the SFDS mockups.
import { NavLink, Outlet } from 'react-router-dom';
import { CalendarIcon, HomeIcon, PinIcon, PlusCircleIcon, UserIcon } from './Icons';

const tabs = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/calendar', label: 'Calendar', Icon: CalendarIcon },
  { to: '/events/new', label: 'Create', Icon: PlusCircleIcon, big: true },
  { to: '/map', label: 'Map', Icon: PinIcon },
  { to: '/profile', label: 'Profile', Icon: UserIcon },
];

export default function Layout() {
  return (
    <div className="app-shell">
      <main className="page">
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Main">
        {tabs.map(({ to, label, Icon, end, big }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Icon size={big ? 30 : 24} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
