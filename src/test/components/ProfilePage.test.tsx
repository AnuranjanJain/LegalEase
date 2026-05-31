import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProfilePage } from '../../pages/ProfilePage';
import { StorageService } from '../../services/storage';
import { api } from '../../services/api';

// Mock useNavigate
const mockNavigate = vi.fn();
let mockParamsTab: string | undefined = 'profile';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ tab: mockParamsTab }),
  };
});

// Mock ToastContext
const mockShowToast = vi.fn();
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

// Mock AuthContext
const mockLogout = vi.fn();
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    logout: mockLogout,
  }),
}));

// Mock NotificationContext
const mockMarkAllRead = vi.fn();
const mockMarkRead = vi.fn();
const mockRemoveNotification = vi.fn();
const mockNotifications = [
  {
    id: 1,
    title: 'Profile Updated',
    description: 'Your profile has been modified.',
    type: 'system' as const,
    read: false,
    timestamp: new Date(),
  },
];

vi.mock('../../contexts/NotificationContext', () => ({
  useNotifications: () => ({
    notifications: mockNotifications,
    unreadCount: 1,
    markAllRead: mockMarkAllRead,
    markRead: mockMarkRead,
    removeNotification: mockRemoveNotification,
  }),
}));

// Mock StorageService
vi.mock('../../services/storage', () => ({
  StorageService: {
    getProfile: vi.fn(),
    saveProfile: vi.fn(),
  },
}));

// Mock api
vi.mock('../../services/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

const mockProfile = {
  firstName: 'Sarah',
  lastName: 'Johnson',
  email: 'sarah.j@example.com',
  phone: '+15551234567',
  bio: 'Legal professional bio.',
  address: {
    street: '123 Main St',
    city: 'New York',
    state: 'NY',
    zip: '10001',
  },
  preferences: {
    language: 'en',
    timezone: 'EST',
    notifications: {
      documents: true,
      security: true,
      marketing: false,
    },
  },
};

describe('ProfilePage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(StorageService.getProfile).mockReturnValue(mockProfile);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders side navigation and default Profile Details tab', () => {
    mockParamsTab = 'profile';
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    // Sidebar navigation items
    expect(screen.getByRole('button', { name: /profile details/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /security & signin/i })).toBeInTheDocument();

    // Check header display in sidebar
    expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
    expect(screen.getByText('sarah.j@example.com')).toBeInTheDocument();

    // Check form fields by display value
    expect(screen.getByDisplayValue('Sarah')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Johnson')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Legal professional bio.')).toBeInTheDocument();
  });

  it('saves modified profile details successfully with timer transition', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ delay: null });
    mockParamsTab = 'profile';

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const firstNameInput = screen.getByDisplayValue('Sarah');
    await act(async () => {
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Jane');
    });

    const saveBtn = screen.getByRole('button', { name: /save updates/i });
    await act(async () => {
      await user.click(saveBtn);
    });

    // Button should display saving state
    expect(screen.getByText('Saving...')).toBeInTheDocument();

    // Advance fake timers by 800ms
    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(StorageService.saveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Jane',
        lastName: 'Johnson',
      })
    );
    expect(mockShowToast).toHaveBeenCalledWith('Profile updated successfully!', 'success');
    expect(screen.getByText('Save Updates')).toBeInTheDocument();
  });

  it('navigates sections when clicking sidebar buttons', async () => {
    const user = userEvent.setup();
    mockParamsTab = 'profile';

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const securityBtn = screen.getByRole('button', { name: /security & signin/i });
    await act(async () => {
      await user.click(securityBtn);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/profile/security', expect.any(Object));
  });

  it('renders and manages Security page items (2FA toggle, session revoking, password forms)', async () => {
    const user = userEvent.setup();
    mockParamsTab = 'security';

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    // Test password change inputs
    const currentPwInput = screen.getByPlaceholderText(/verify current password/i);
    const newPwInput = screen.getByPlaceholderText(/enter new password/i);
    const confirmPwInput = screen.getByPlaceholderText(/confirm new password/i);

    expect(currentPwInput).toBeInTheDocument();
    expect(newPwInput).toBeInTheDocument();
    expect(confirmPwInput).toBeInTheDocument();

    // Fill form and trigger password change mock
    await act(async () => {
      await user.type(currentPwInput, 'oldpassword');
      await user.type(newPwInput, 'newpassword123');
      await user.type(confirmPwInput, 'newpassword123');
    });

    vi.mocked(api.post).mockResolvedValue({ detail: 'Password updated successfully' });

    const changePwBtn = screen.getByRole('button', { name: /update password/i });
    await act(async () => {
      await user.click(changePwBtn);
    });

    expect(api.post).toHaveBeenCalledWith('/auth/change-password', {
      current_password: 'oldpassword',
      new_password: 'newpassword123',
    });
    expect(mockShowToast).toHaveBeenCalledWith('Password updated. Please sign in again.', 'success');
    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('renders system alerts page with active notification feed interaction', async () => {
    const user = userEvent.setup();
    mockParamsTab = 'notifications';

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByText('Profile Updated')).toBeInTheDocument();
    expect(screen.getByText('Your profile has been modified.')).toBeInTheDocument();

    // Mark as read click
    const markReadBtn = screen.getByRole('button', { name: /mark read/i });
    await act(async () => {
      await user.click(markReadBtn);
    });
    expect(mockMarkRead).toHaveBeenCalledWith(1);

    // Delete notification click
    const deleteBtn = screen.getByLabelText(/remove notification/i);
    await act(async () => {
      await user.click(deleteBtn);
    });
    expect(mockRemoveNotification).toHaveBeenCalledWith(1);
  });

  it('renders language and zone tab and triggers preferences save', async () => {
    const user = userEvent.setup();
    mockParamsTab = 'language';

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    // Renders language buttons
    expect(screen.getByRole('button', { name: /english/i })).toBeInTheDocument();
    
    // Choose Spanish
    const spanishBtn = screen.getByRole('button', { name: /spanish/i });
    await act(async () => {
      await user.click(spanishBtn);
    });

    // Save regional updates
    const saveBtn = screen.getByRole('button', { name: /save regional layout/i });
    await act(async () => {
      await user.click(saveBtn);
    });

    expect(StorageService.saveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({
          language: 'es',
        }),
      })
    );
    expect(mockShowToast).toHaveBeenCalledWith('Language & region settings saved!', 'success');
  });
});
