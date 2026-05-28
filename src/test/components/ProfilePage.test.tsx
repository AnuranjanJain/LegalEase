import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProfilePage } from '../../pages/ProfilePage';
import { StorageService } from '../../services/storage';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';

vi.mock('../../services/storage', () => ({
  StorageService: {
    getProfile: vi.fn(),
    saveProfile: vi.fn(),
  },
}));

const mockProfile = {
  firstName: 'Sarah',
  lastName: 'Wilson',
  email: 'sarah.w@example.com',
  phone: '+1-555-123-4567',
  bio: 'Legal professional',
  preferences: {
    language: 'en',
    timezone: 'EST',
    notifications: {
      documents: true,
      security: true,
      marketing: false,
    },
  },
  address: {
    street: '123 Main St',
    city: 'New York',
    state: 'NY',
    zip: '10001',
    country: 'US',
  },
};

function renderProfile(route = '/profile') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <NotificationProvider>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/:tab" element={<ProfilePage />} />
          </Routes>
        </NotificationProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (StorageService.getProfile as ReturnType<typeof vi.fn>).mockReturnValue(mockProfile);
  });

  it('renders profile sidebar with user name', () => {
    renderProfile();
    expect(screen.getByText('Sarah Wilson')).toBeInTheDocument();
  });

  it('renders profile sidebar with email', () => {
    renderProfile();
    expect(screen.getByText('sarah.w@example.com')).toBeInTheDocument();
  });

  it('renders sidebar navigation items', () => {
    renderProfile();
    expect(screen.getByText('Profile Details')).toBeInTheDocument();
    expect(screen.getByText('Security & Signin')).toBeInTheDocument();
    expect(screen.getByText('System Alerts')).toBeInTheDocument();
    expect(screen.getByText('Language & Zone')).toBeInTheDocument();
  });

  it('renders profile form fields', () => {
    renderProfile();
    expect(screen.getByDisplayValue('Sarah')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Wilson')).toBeInTheDocument();
    expect(screen.getByDisplayValue('sarah.w@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+1-555-123-4567')).toBeInTheDocument();
  });

  it('renders bio textarea', () => {
    renderProfile();
    expect(screen.getByDisplayValue('Legal professional')).toBeInTheDocument();
  });

  it('renders save button on profile tab', () => {
    renderProfile();
    expect(screen.getByText('Save Updates')).toBeInTheDocument();
  });

  it('navigates to security tab on sidebar click', async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByText('Security & Signin'));
    expect(screen.getByText(/Modify Account Password/i)).toBeInTheDocument();
  });

  it('renders password fields in security tab', async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByText('Security & Signin'));
    expect(screen.getByPlaceholderText('Verify Current Password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter New Password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Confirm New Password')).toBeInTheDocument();
  });

  it('navigates to notifications tab', async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByText('System Alerts'));
    expect(screen.getByText(/Notification channels/i)).toBeInTheDocument();
  });

  it('navigates to language tab', async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByText('Language & Zone'));
    expect(screen.getByText(/Display Interface Language/i)).toBeInTheDocument();
  });

  it('renders notification toggles in notifications tab', async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByText('System Alerts'));
    const toggles = screen.getAllByRole('button', { pressed: true });
    expect(toggles.length).toBeGreaterThan(0);
  });
});
