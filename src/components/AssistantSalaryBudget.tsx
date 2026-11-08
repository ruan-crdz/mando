import { type Career } from '../game/types';
import { assistantPayroll, salaryBudgets, setAssistantSalaryBudget } from '../game/staff';
import { NumberStepper } from './controls';
import { money } from './ui';

export function AssistantSalaryBudget({
  career,
  onChange,
  onError,
}: {
  career: Career;
  onChange: (career: Career) => void;
  onError: (message: string) => void;
}) {
  const budget = salaryBudgets(career);
  const wages = Math.ceil(assistantPayroll(career));
  return (
    <section className="panel assistant-budget" aria-label="Orçamento salarial da comissão">
      <div>
        <h3>Orçamento salarial dos auxiliares</h3>
        <p className="muted small">
          Redistribua o limite mensal entre jogadores e auxiliares. Isso não retira dinheiro do
          caixa; os salários são pagos no fechamento do mês.
        </p>
      </div>
      <div className="assistant-budget-values">
        <span>
          Limite dos jogadores <strong>{money(budget.players)}/mês</strong>
        </span>
        <span>
          Comprometido com jogadores <strong>{money(budget.committed)}/mês</strong>
        </span>
        <span>
          Salários dos auxiliares <strong>{money(wages)}/mês</strong>
        </span>
        <span>
          Livre para auxiliares <strong>{money(budget.assistants - wages)}/mês</strong>
        </span>
      </div>
      <NumberStepper
        label="Orçamento mensal dos auxiliares"
        value={budget.assistants}
        min={wages}
        max={budget.assistants + budget.available}
        step={1000}
        format={money}
        onChange={(value) => {
          if (value === null) {
            onError('Informe um orçamento mensal válido para os auxiliares.');
            return;
          }
          try {
            onChange(setAssistantSalaryBudget(career, value));
          } catch (error) {
            onError(error instanceof Error ? error.message : String(error));
          }
        }}
      />
    </section>
  );
}
