import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ComplianceContextType {
  hasAcceptedCompliance: boolean;
  isModalOpen: boolean;
  acceptCompliance: () => void;
  requireCompliance: (onSuccess: () => void) => void;
  closeModal: () => void;
}

const ComplianceContext = createContext<ComplianceContextType | undefined>(undefined);

export function ComplianceProvider({ children }: { children: ReactNode }) {
  const [hasAcceptedCompliance, setHasAcceptedCompliance] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    const storedStatus = localStorage.getItem('le_compliance_accepted');
    if (storedStatus === 'true') {
      setHasAcceptedCompliance(true);
    }
  }, []);

  const acceptCompliance = () => {
    localStorage.setItem('le_compliance_accepted', 'true');
    setHasAcceptedCompliance(true);
    setIsModalOpen(false);
    
    // Execute the action that was waiting for compliance approval
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const requireCompliance = (onSuccess: () => void) => {
    if (hasAcceptedCompliance) {
      onSuccess();
    } else {
      setPendingAction(() => onSuccess);
      setIsModalOpen(true);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setPendingAction(null);
  };

  return (
    <ComplianceContext.Provider value={{
      hasAcceptedCompliance,
      isModalOpen,
      acceptCompliance,
      requireCompliance,
      closeModal
    }}>
      {children}
    </ComplianceContext.Provider>
  );
}

export function useCompliance() {
  const context = useContext(ComplianceContext);
  if (context === undefined) {
    throw new Error('useCompliance must be used within a ComplianceProvider');
  }
  return context;
}
