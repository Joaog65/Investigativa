export default function StatusBadge({ value }) {
  if (!value) return null;
  const label = {
    ativa: 'Ativa',
    inativa: 'Inativa',
    dissolvida: 'Dissolvida',
    ativo: 'Ativo',
    afastado: 'Afastado',
    expulso: 'Expulso',
    desaparecido: 'Desaparecido',
    alianca: 'Aliança',
    rivalidade: 'Rivalidade',
    neutralidade: 'Neutralidade',
    vigente: 'Vigente',
    encerrada: 'Encerrada',
    aberta: 'Aberta',
    em_andamento: 'Em andamento',
    admin: 'Admin',
  }[value] || value;

  return <span className={`badge badge--${value}`}>{label}</span>;
}
