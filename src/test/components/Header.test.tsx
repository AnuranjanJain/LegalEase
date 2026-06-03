import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Header } from '../../components/Header';
import { AuthProvider } from '../../contexts/AuthContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { ToastProvider } from '../../contexts/ToastContext';

function renderHeader() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <AuthProvider>
          <NotificationProvider>
            <Header />
          </NotificationProvider>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the LegalEase logo', () => {
    renderHeader();
    expect(screen.getByText('LegalEase')).toBeInTheDocument();
  });

  it('renders all navigation links', () => {
    renderHeader();
    const homeLinks = screen.getAllByText('Home');
    expect(homeLinks.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Documents').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Legal Resources').length).toBeGreaterThanOrEqual(1);
  });

  it('renders theme toggle button', () => {
    renderHeader();
    const buttons = screen.getAllByRole('button');
    const toggleBtn = buttons.find(b =>
      b.innerHTML.includes('sun') || b.innerHTML.includes('moon')
    );
    expect(toggleBtn).toBeTruthy();
  });

  it('renders notification bell with aria-label', () => {
    renderHeader();
    const bell = screen.getByLabelText('View notifications');
    expect(bell).toBeInTheDocument();
  });

  it('renders user profile button', () => {
    renderHeader();
    const userBtn = screen.getByLabelText('Open user profile menu');
    expect(userBtn).toBeInTheDocument();
  });

  it('toggles mobile menu when hamburger button is clicked', async () => {
    const user = userEvent.setup();
    renderHeader();
    const menuBtn = screen.getByLabelText('Open main menu');
    expect(menuBtn).toBeInTheDocument();
    await user.click(menuBtn);
    const homeLinks = screen.getAllByText('Home');
    const desktopNav = homeLinks.find(el => el.closest('nav')?.className.includes('hidden'));
    const mobileNavLink = homeLinks.find(el => !el.closest('nav')?.className.includes('hidden'));
    expect(desktopNav).toBeInTheDocument();
    expect(mobileNavLink).toBeInTheDocument();
  });

  it('shows notification dropdown when bell is clicked', async () => {
    const user = userEvent.setup();
    renderHeader();
    const bell = screen.getByLabelText('View notifications');
    await user.click(bell);
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('shows user menu when profile button is clicked', async () => {
    const user = userEvent.setup();
    renderHeader();
    const userBtn = screen.getByLabelText('Open user profile menu');
    await user.click(userBtn);
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  it('renders notification badge with unread count', () => {
    renderHeader();
    const bell = screen.getByLabelText('View notifications');
    const badge = bell.querySelector('span.h-2.w-2');
    expect(badge).toBeInTheDocument();
  });
});
