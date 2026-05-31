import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Header } from '../../components/Header';

// Setup mocks
const mockToggleDarkMode = vi.fn();
let mockIsDarkMode = false;
vi.mock('../../hooks/useDarkMode', () => ({
  useDarkMode: () => ({
    isDarkMode: mockIsDarkMode,
    toggleDarkMode: mockToggleDarkMode,
  }),
}));

const mockMarkAllRead = vi.fn();
const mockMarkRead = vi.fn();
const mockNotifications = [
  {
    id: 1,
    title: 'Unread Alert',
    description: 'This is an unread alert',
    type: 'system' as const,
    read: false,
    timestamp: new Date(),
  },
  {
    id: 2,
    title: 'Read Notification',
    description: 'This is a read notification',
    type: 'document' as const,
    read: true,
    timestamp: new Date(Date.now() - 60000),
  },
];
vi.mock('../../contexts/NotificationContext', () => ({
  useNotifications: () => ({
    notifications: mockNotifications,
    unreadCount: 1,
    markAllRead: mockMarkAllRead,
    markRead: mockMarkRead,
    addNotification: vi.fn(),
    removeNotification: vi.fn(),
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Header Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders brand name and desktop navigation links', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    expect(screen.getByText('LegalEase')).toBeInTheDocument();
    
    // Check navigation links (each link exists twice: desktop and mobile)
    expect(screen.getAllByRole('link', { name: /home/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /dashboard/i }).length).toBe(2);
    expect(screen.getAllByRole('link', { name: /documents/i }).length).toBe(2);
    expect(screen.getAllByRole('link', { name: /chatbot/i }).length).toBe(2);
  });

  it('triggers toggleDarkMode when the theme toggle button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    // Find the theme button (the only button without an aria-label containing the icon)
    const buttons = screen.getAllByRole('button');
    const themeBtn = buttons.find(b => 
      !b.getAttribute('aria-label') && 
      !b.getAttribute('aria-haspopup') && 
      !b.classList.contains('w-full')
    );
    
    expect(themeBtn).toBeDefined();
    await act(async () => {
      await user.click(themeBtn!);
    });

    expect(mockToggleDarkMode).toHaveBeenCalledTimes(1);
  });

  it('toggles the mobile menu dropdown on click', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    const mobileMenuBtn = screen.getByRole('button', { name: /open main menu/i });
    
    // Initially mobile menu should be collapsed or hidden (not expanded)
    expect(mobileMenuBtn).toHaveAttribute('aria-expanded', 'false');

    // Click to open mobile menu inside act
    await act(async () => {
      await user.click(mobileMenuBtn);
    });
    expect(mobileMenuBtn).toHaveAttribute('aria-expanded', 'true');

    // Click again to close inside act
    await act(async () => {
      await user.click(mobileMenuBtn);
    });
    expect(mobileMenuBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles notification panel dropdown and handles mark as read', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    const bellBtn = screen.getByRole('button', { name: /view notifications/i });
    
    // Click notifications bell to open dropdown inside act
    await act(async () => {
      await user.click(bellBtn);
    });

    // Verify unread notification title is displayed
    expect(screen.getByText('Unread Alert')).toBeInTheDocument();
    expect(screen.getByText('This is an unread alert')).toBeInTheDocument();

    // Verify mark all read button inside act
    const markAllReadBtn = screen.getByRole('button', { name: /mark all as read/i });
    await act(async () => {
      await user.click(markAllReadBtn);
    });
    expect(mockMarkAllRead).toHaveBeenCalledTimes(1);

    // Click individual unread notification to mark as read inside act
    const unreadNotifEl = screen.getByText('Unread Alert');
    await act(async () => {
      await user.click(unreadNotifEl);
    });
    expect(mockMarkRead).toHaveBeenCalledWith(1);
  });

  it('toggles user profile dropdown menu', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    const profileBtn = screen.getByRole('button', { name: /open user profile menu/i });
    expect(profileBtn).toHaveAttribute('aria-expanded', 'false');

    // Open dropdown inside act
    await act(async () => {
      await user.click(profileBtn);
    });
    expect(profileBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Sarah Wilson')).toBeInTheDocument();
    expect(screen.getByText('sarah.w@example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
  });
});
