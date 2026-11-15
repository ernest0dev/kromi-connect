import { getGeneralDeliverableCapabilities } from './generalDeliverableCapabilities';

const base = {
  status: 'EN_DISENO',
  canReadDeliverables: true,
  completedDeliverables: 1,
};

describe('GENERAL deliverable UI capabilities', () => {
  it('shows upload and delivery when both permissions are present', () => {
    expect(getGeneralDeliverableCapabilities({ ...base, canUploadDeliverables: true, canDeliver: true })).toMatchObject({
      showUploadControl: true,
      showDeliverAction: true,
      showCompletedDeliverables: true,
    });
  });

  it('shows upload without delivery when only upload permission is present', () => {
    expect(getGeneralDeliverableCapabilities({ ...base, canUploadDeliverables: true, canDeliver: false })).toMatchObject({
      showUploadControl: true,
      showDeliverAction: false,
    });
  });

  it('shows delivery without upload when only delivery permission is present', () => {
    expect(getGeneralDeliverableCapabilities({ ...base, canUploadDeliverables: false, canDeliver: true })).toMatchObject({
      showUploadControl: false,
      showDeliverAction: true,
    });
  });

  it('hides both mutation actions without either permission', () => {
    expect(getGeneralDeliverableCapabilities({ ...base, canUploadDeliverables: false, canDeliver: false })).toMatchObject({
      showUploadControl: false,
      showDeliverAction: false,
    });
  });

  it('hides completed files when the actor lacks file read capability', () => {
    expect(getGeneralDeliverableCapabilities({ ...base, canReadDeliverables: false, canUploadDeliverables: false, canDeliver: true })).toMatchObject({
      showCompletedDeliverables: false,
      showDeliverAction: true,
    });
  });
});
