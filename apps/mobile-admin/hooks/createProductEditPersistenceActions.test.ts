import { Alert } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProductEditFormData } from '@/components/product/product-edit.defaults';
import { createProductEditPersistenceActions } from './createProductEditPersistenceActions';

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
}));

describe('createProductEditPersistenceActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a validation alert when the product name is missing', async () => {
    const actions = createProductEditPersistenceActions({
      createCategory: vi.fn(),
      createProduct: vi.fn(),
      formData: createInitialProductEditFormData(),
      hasVariantConditionAxis: false,
      isEditing: false,
      newCategoryName: '',
      openProduct: vi.fn(),
      resetCategoryForm: vi.fn(),
      revertStatus: vi.fn(),
      routerBack: vi.fn(),
      saveInFlightRef: { current: false },
      selectCreatedCategory: vi.fn(),
      updateProduct: vi.fn(),
      updateStatus: vi.fn(),
    });

    await actions.handleSave();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Validation Error',
      'Product name is required'
    );
  });

  it('updates an existing product and navigates back on success', async () => {
    const updateProduct = vi.fn().mockResolvedValue(undefined);
    const routerBack = vi.fn();
    const formData = {
      ...createInitialProductEditFormData(),
      name: 'Baci Phone',
      price: 1000,
    };

    const actions = createProductEditPersistenceActions({
      createCategory: vi.fn(),
      createProduct: vi.fn(),
      formData,
      hasVariantConditionAxis: false,
      id: 'product-1',
      isEditing: true,
      newCategoryName: '',
      openProduct: vi.fn(),
      resetCategoryForm: vi.fn(),
      revertStatus: vi.fn(),
      routerBack,
      saveInFlightRef: { current: false },
      selectCreatedCategory: vi.fn(),
      updateProduct,
      updateStatus: vi.fn(),
    });

    await actions.handleSave();

    expect(updateProduct).toHaveBeenCalledWith({
      id: 'product-1',
      updates: formData,
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Success',
      'Product updated successfully'
    );
    expect(routerBack).toHaveBeenCalled();
  });

  it('shows an error alert when updating an existing product fails', async () => {
    const updateProduct = vi.fn().mockRejectedValue(new Error('Update failed'));
    const routerBack = vi.fn();
    const formData = {
      ...createInitialProductEditFormData(),
      name: 'Baci Phone',
      price: 1000,
    };

    const actions = createProductEditPersistenceActions({
      createCategory: vi.fn(),
      createProduct: vi.fn(),
      formData,
      hasVariantConditionAxis: false,
      id: 'product-1',
      isEditing: true,
      newCategoryName: '',
      openProduct: vi.fn(),
      resetCategoryForm: vi.fn(),
      revertStatus: vi.fn(),
      routerBack,
      saveInFlightRef: { current: false },
      selectCreatedCategory: vi.fn(),
      updateProduct,
      updateStatus: vi.fn(),
    });

    await actions.handleSave();

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Update failed');
    expect(routerBack).not.toHaveBeenCalled();
  });

  it('shows a safe fallback when a non-Error value is thrown during save', async () => {
    const updateProduct = vi.fn().mockRejectedValue('unexpected failure');

    const actions = createProductEditPersistenceActions({
      createCategory: vi.fn(),
      createProduct: vi.fn(),
      formData: {
        ...createInitialProductEditFormData(),
        name: 'Baci Phone',
        price: 1000,
      },
      hasVariantConditionAxis: false,
      id: 'product-1',
      isEditing: true,
      newCategoryName: '',
      openProduct: vi.fn(),
      resetCategoryForm: vi.fn(),
      revertStatus: vi.fn(),
      routerBack: vi.fn(),
      saveInFlightRef: { current: false },
      selectCreatedCategory: vi.fn(),
      updateProduct,
      updateStatus: vi.fn(),
    });

    await actions.handleSave();

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'unexpected failure');
  });

  it('creates a new product and navigates back on success', async () => {
    const createProduct = vi.fn().mockResolvedValue(undefined);
    const routerBack = vi.fn();
    const formData = {
      ...createInitialProductEditFormData(),
      name: 'New Product',
      price: 2500,
    };

    const actions = createProductEditPersistenceActions({
      createCategory: vi.fn(),
      createProduct,
      formData,
      hasVariantConditionAxis: false,
      isEditing: false,
      newCategoryName: '',
      openProduct: vi.fn(),
      resetCategoryForm: vi.fn(),
      revertStatus: vi.fn(),
      routerBack,
      saveInFlightRef: { current: false },
      selectCreatedCategory: vi.fn(),
      updateProduct: vi.fn(),
      updateStatus: vi.fn(),
    });

    await actions.handleSave();

    expect(createProduct).toHaveBeenCalledWith(formData);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Success',
      'Product created successfully'
    );
    expect(routerBack).toHaveBeenCalled();
  });

  it('short-circuits when a save is already in flight', async () => {
    const createProduct = vi.fn();
    const updateProduct = vi.fn();

    const actions = createProductEditPersistenceActions({
      createCategory: vi.fn(),
      createProduct,
      formData: {
        ...createInitialProductEditFormData(),
        name: 'Baci Phone',
        price: 1000,
      },
      hasVariantConditionAxis: false,
      isEditing: false,
      newCategoryName: '',
      openProduct: vi.fn(),
      resetCategoryForm: vi.fn(),
      revertStatus: vi.fn(),
      routerBack: vi.fn(),
      saveInFlightRef: { current: true },
      selectCreatedCategory: vi.fn(),
      updateProduct,
      updateStatus: vi.fn(),
    });

    await actions.handleSave();

    expect(createProduct).not.toHaveBeenCalled();
    expect(updateProduct).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
