import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MergeTablesDialog } from '@/components/MergeTablesDialog';

describe('MergeTablesDialog', () => {
  test('renders merge copy and actions', () => {
    render(
      <MergeTablesDialog
        activePlayers={8}
        mergeThreshold={8}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByText('Объединить столы?')).toBeInTheDocument();
    expect(screen.getByText(/В игре осталось 8/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Объединить' })).toBeInTheDocument();
  });

  test('calls cancel and confirm handlers', async () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    const user = userEvent.setup();

    render(
      <MergeTablesDialog
        activePlayers={4}
        mergeThreshold={4}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Отмена' }));
    await user.click(screen.getByRole('button', { name: 'Объединить' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
