export function getGeneralDeliverableCapabilities(input: {
  status: string;
  canReadDeliverables: boolean;
  canUploadDeliverables: boolean;
  canDeliver: boolean;
  completedDeliverables: number;
}) {
  const inDesign = input.status === 'EN_DISENO';
  return {
    showCompletedDeliverables: input.canReadDeliverables && input.completedDeliverables > 0,
    showUploadControl: input.canUploadDeliverables && inDesign,
    showDeliverAction: input.canDeliver && inDesign && input.completedDeliverables > 0,
  };
}
