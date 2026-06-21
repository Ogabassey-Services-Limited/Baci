import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InlineContextMenu } from './inline-context-menu';

async function expectDropdownMenuClosed() {
  await waitFor(() => {
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
}

describe('InlineContextMenu', () => {
  it('calls respective handlers on toolbar button clicks (success path)', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();

    render(
      <InlineContextMenu
        componentId="test-1"
        componentType="Hero"
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    );

    // Verify component type is rendered
    expect(screen.getByText('Hero')).toBeInTheDocument();

    // Click Edit Properties
    const editBtn = screen.getByRole('button', { name: 'Edit Properties' });
    await user.click(editBtn);
    expect(onEdit).toHaveBeenCalledTimes(1);

    // Click Duplicate
    const duplicateBtn = screen.getByRole('button', { name: 'Duplicate' });
    await user.click(duplicateBtn);
    expect(onDuplicate).toHaveBeenCalledTimes(1);

    // Click Delete
    const deleteBtn = screen.getByRole('button', { name: 'Delete' });
    await user.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('respects disabled states for Move Up / Move Down (edge case)', async () => {
    const user = userEvent.setup();
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();

    render(
      <InlineContextMenu
        componentId="test-2"
        componentType="Features"
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={false}
        canMoveDown={false}
      />
    );

    const moveUpBtn = screen.getByRole('button', { name: 'Move Up' });
    const moveDownBtn = screen.getByRole('button', { name: 'Move Down' });

    expect(moveUpBtn).toBeDisabled();
    expect(moveDownBtn).toBeDisabled();

    const moreBtn = screen.getByRole('button', { name: 'More Options' });
    await user.click(moreBtn);
    const menu = screen.getByRole('menu');
    expect(
      within(menu).queryByRole('menuitem', { name: 'Move Up' })
    ).not.toBeInTheDocument();
    expect(
      within(menu).queryByRole('menuitem', { name: 'Move Down' })
    ).not.toBeInTheDocument();

    // Although they are disabled, click them and verify handlers are not called.
    await user.click(moveUpBtn);
    await user.click(moveDownBtn);

    expect(onMoveUp).not.toHaveBeenCalled();
    expect(onMoveDown).not.toHaveBeenCalled();
  });

  it('calls move handlers when not disabled', async () => {
    const user = userEvent.setup();
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();

    render(
      <InlineContextMenu
        componentId="test-3"
        componentType="Features"
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={true}
        canMoveDown={true}
      />
    );

    const moveUpBtn = screen.getByRole('button', { name: 'Move Up' });
    const moveDownBtn = screen.getByRole('button', { name: 'Move Down' });

    expect(moveUpBtn).not.toBeDisabled();
    expect(moveDownBtn).not.toBeDisabled();

    await user.click(moveUpBtn);
    expect(onMoveUp).toHaveBeenCalledTimes(1);

    await user.click(moveDownBtn);
    expect(onMoveDown).toHaveBeenCalledTimes(1);
  });

  it('calls respective handlers from the More Options dropdown menu', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();

    render(
      <InlineContextMenu
        componentId="test-4"
        componentType="Hero"
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    );

    // Open More Options dropdown
    const moreBtn = screen.getByRole('button', { name: 'More Options' });
    await user.click(moreBtn);

    // Get the dropdown menu
    const menu = screen.getByRole('menu');

    // Click Edit Properties in dropdown
    const editMenuItem = within(menu).getByRole('menuitem', {
      name: 'Edit Properties',
    });
    await user.click(editMenuItem);
    expect(onEdit).toHaveBeenCalledTimes(1);

    // Menu closes after click, reopen it
    await expectDropdownMenuClosed();
    await user.click(moreBtn);
    const menu2 = screen.getByRole('menu');

    // Click Duplicate in dropdown
    const duplicateMenuItem = within(menu2).getByRole('menuitem', {
      name: 'Duplicate',
    });
    await user.click(duplicateMenuItem);
    expect(onDuplicate).toHaveBeenCalledTimes(1);

    // Menu closes after click, reopen it
    await expectDropdownMenuClosed();
    await user.click(moreBtn);
    const menu3 = screen.getByRole('menu');

    // Click Delete in dropdown
    const deleteMenuItem = within(menu3).getByRole('menuitem', {
      name: 'Delete',
    });
    await user.click(deleteMenuItem);
    expect(onDelete).toHaveBeenCalledTimes(1);
    await expectDropdownMenuClosed();
  });
});
