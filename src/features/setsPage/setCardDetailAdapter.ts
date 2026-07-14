import type { CardDetailProductCopy } from '../cardDetail';
import {
  createCardDetailOwnershipPresentation,
  hasConfirmedAbsence,
  hasConfirmedPhysicalPresence,
} from '../cardDetail/cardDetailOwnershipPresentation.ts';
import type { ConfirmedOwnership } from '../collectionCards';

export { hasConfirmedAbsence, hasConfirmedPhysicalPresence };

export function createSetCardDetailProductCopy(params: {
  ownership: ConfirmedOwnership | undefined;
  hasConflictingRows: boolean;
  showManageElsewhere: boolean;
}): CardDetailProductCopy {
  const presentation = createCardDetailOwnershipPresentation({
    ownership: params.ownership,
    hasConflict: params.hasConflictingRows,
  });

  return {
    statusItems: presentation.statusItems,
    physicalPresenceLabel: presentation.physicalPresenceLabel,
    managementMessage: params.showManageElsewhere ? 'Beheer via collectie' : presentation.conflictMessage,
  };
}
