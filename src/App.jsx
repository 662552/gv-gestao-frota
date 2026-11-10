import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const db = url && key ? createClient(url, key) : null;
const modules = ['Visão geral', 'Veículos', 'Abastecimentos', 'Produção', 'Manutenção', 'Documentos', 'Fundo fixo'];
const emptyVehicle = { plate: '', category: 'carro', ownership_group: 'carro', model: '', renavam: '', chassis: '', city: '', driver_name: '', status: 'ativo' };
const ownershipLabels = { carro: 'Carro', moto_empresa: 'Moto da empresa', moto_alugada_funcionario: 'Moto alugada por funcionário' };
const cleanPlate = value => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);

export default function App() {
  const [session, setSession] = useState(null);
  const [page, setPage] = useState('Visão geral');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [message, setMessage] = useState('');
  const [role, setRole] = useState('consulta');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyVehicle);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!db) return;
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = db.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !db) return;
    db.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
      .then(({ data, error }) => {
        if (error) setMessage(`Erro ao consultar perfil: ${error.message}`);
        else setRole(data?.role || 'consulta');
      });
  }, [session]);

  useEffect(() => {
    if (session && page === 'Veículos') loadVehicles();
  }, [session, page]);

  async function login(e) {
    e.preventDefault();
    const { error } = await db.auth.signInWithPassword({ email, password: pass });
    setMessage(error?.message || '');
  }

  async function loadVehicles() {
    setLoading(true);
    setMessage('');
    const { data, error } = await db.from('vehicles')
      .select('id,plate,category,ownership_group,model,renavam,chassis,city,driver_name,status')
      .order('plate');
    setRows(data || []);
    if (error) setMessage(`Erro ao carregar veículos: ${error.message}`);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm(emptyVehicle);
    setFormOpen(true);
    setMessage('');
  }

  function openEdit(v) {
    setEditing(v);
    setForm({ ...emptyVehicle, ...v });
    setFormOpen(true);
    setMessage('');
  }

  function changeField(field, value) {
    setForm(old => {
      const next = { ...old, [field]: value };
      if (field === 'category') next.ownership_group = value === 'carro' ? 'carro' : 'moto_empresa';
      if (field === 'ownership_group') next.category = value === 'carro' ? 'carro' : 'moto';
      return next;
    });
  }

  async function saveVehicle(e) {
    e.preventDefault();
    const plate = cleanPlate(form.plate);
    if (plate.length !== 7) {
      setMessage('Informe uma placa válida com 7 caracteres.');
      return;
    }
    setSaving(true);
    const payload = {
      plate, category: form.category, ownership_group: form.ownership_group,
      model: form.model.trim() || null, renavam: form.renavam.trim() || null,
      chassis: form.chassis.trim() || null, city: form.city.trim() || null,
      driver_name: form.driver_name.trim() || null, status: form.status
    };
    const result = editing
      ? await db.from('vehicles').update(payload).eq('id', editing.id)
      : await db.from('vehicles').insert({ ...payload, created_by: session.user.id });
    setSaving(false);
    if (result.error) {
      setMessage(`Erro ao salvar: ${result.error.message}`);
      return;
    }
    setFormOpen(false);
    setEditing(null);
    setMessage(editing ? 'Veículo atualizado com sucesso.' : 'Veículo cadastrado com sucesso.');
    await loadVehicles();
  }

  async function deleteVehicle(v) {
    if (role !== 'administrador') return;
    if (!window.confirm(`Confirma a exclusão do veículo ${v.plate}?`)) return;
    const { error } = await db.from('vehicles').delete().eq('id', v.id);
    setMessage(error ? `Erro ao excluir: ${error.message}` : `Veículo ${v.plate} excluído.`);
    if (!error) loadVehicles();
  }

  const visibleRows = useMemo(() => rows.filter(v => {
    const typeOk = filter === 'todos' ||
      (filter === 'carros' && v.ownership_group === 'carro') ||
      (filter === 'motos_empresa' && v.ownership_group === 'moto_empresa') ||
      (filter === 'motos_alugadas' && v.ownership_group === 'moto_alugada_funcionario') ||
      (filter === 'todas_motos' && v.category === 'moto');
    const text = [v.plate, v.model, v.city, v.driver_name].filter(Boolean).join(' ').toLowerCase();
    return typeOk && text.includes(search.toLowerCase());
  }), [rows, filter, search]);

  function exportCsv() {
    const headers = ['Placa','Categoria','Tipo de vínculo','Modelo','Renavam','Chassi','Localidade','Condutor','Status'];
    const values = visibleRows.map(v => [v.plate,v.category,ownershipLabels[v.ownership_group],v.model,v.renavam,v.chassis,v.city,v.driver_name,v.status]);
    const csv = [headers, ...values].map(row => row.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    const objectUrl = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.href = objectUrl; a.download = 'gv-relacao-de-veiculos.csv'; a.click(); URL.revokeObjectURL(objectUrl);
  }

  if (!db) return <main className="center"><h1>GV Gestão de Frota</h1><p>Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Vercel.</p></main>;
  if (!session) return <main className="center"><form className="login" onSubmit={login}><h1>GV Gestão de Frota</h1><p>Acesso operacional</p><label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label><label>Senha<input type="password" value={pass} onChange={e=>setPass(e.target.value)} required /></label><button>Entrar</button>{message && <small>{message}</small>}</form></main>;

  return <div className="layout">
    <style>{`
      *{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:#f3f4f6;color:#292d34}
      .center{min-height:100vh;display:grid;place-content:center;padding:20px}.login{background:white;padding:28px;border-radius:12px;width:min(380px,95vw);display:grid;gap:12px}.login label,.vehicle-form label{display:grid;gap:6px;font-size:14px}.login input,.vehicle-form input,.vehicle-form select,.toolbar input,.toolbar select{padding:10px;border:1px solid #ccd0d5;border-radius:7px;font:inherit;min-width:0}
      .layout{min-height:100vh;display:grid;grid-template-columns:218px 1fr}.layout aside{background:#252a32;color:white;padding:24px 12px;display:flex;flex-direction:column;gap:8px}.layout aside h2{color:#ff7a24;margin:12px 8px 24px}.layout aside h2 span{font-size:11px;color:white}.layout aside button{background:transparent;color:#ddd;text-align:left;border:0;padding:12px;border-radius:8px;cursor:pointer}.layout aside button.sel,.layout aside button:hover{background:#414751}.layout main{padding:28px;min-width:0}.layout main>small{color:#777}.layout main h1{margin:15px 0 24px}.hero{background:linear-gradient(110deg,#f36b16,#fa9a4b);color:white;padding:28px;border-radius:14px;margin-bottom:18px}.grid{display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:12px}.grid article,.panel{background:white;border:1px solid #ddd;border-radius:10px;padding:20px}.grid article{cursor:pointer}.grid article p{color:#777}.primary,.login button{background:#f47721;color:white;border:0;border-radius:7px;padding:11px 15px;cursor:pointer}.secondary,.danger{border:0;border-radius:6px;padding:9px 12px;cursor:pointer}.secondary{background:#eceff2}.danger{background:#fff0ed;color:#a22}.toolbar{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:14px 0}.toolbar input{width:260px}.toolbar select{max-width:230px}.table-wrap{overflow:auto;background:white;border:1px solid #ddd;border-radius:9px}table{width:100%;border-collapse:collapse;min-width:760px}th,td{text-align:left;padding:12px;border-bottom:1px solid #eee;font-size:14px}th{background:#fff}.status{color:#24733a;background:#e7f6ec;padding:4px 8px;border-radius:20px}.status.inativo{color:#555;background:#eee}.empty{padding:22px;color:#777}.message{color:#9b3d12;margin:12px 0}.modal{position:fixed;inset:0;background:#0008;display:grid;place-items:center;padding:16px;z-index:5}.vehicle-form{background:white;padding:24px;border-radius:12px;width:min(700px,96vw);max-height:92vh;overflow:auto;display:grid;gap:14px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.actions{display:flex;justify-content:flex-end;gap:9px}.hint{color:#777;font-size:12px}@media(max-width:760px){.layout{grid-template-columns:1fr}.layout aside{display:grid;grid-template-columns:1fr 1fr}.layout aside h2{grid-column:1/-1}.layout main{padding:16px}.grid{grid-template-columns:1fr 1fr}.form-grid{grid-template-columns:1fr}}
    `}</style>
    <aside><h2>GV <span>GESTÃO</span></h2><small>Perfil: {role}</small>{modules.map(x=><button key={x} className={page===x?'sel':''} onClick={()=>setPage(x)}>{x}</button>)}<button onClick={()=>db.auth.signOut()}>Sair</button></aside>
    <main><small>PAINEL OPERACIONAL</small><h1>{page}</h1>
      {page==='Visão geral' && <><section className="hero"><h2>Controle centralizado da frota</h2><p>Cadastros, operações e relatórios em um só lugar.</p></section><div className="grid">{modules.slice(1).map(x=><article key={x} onClick={()=>setPage(x)}><b>{x}</b><p>Acessar módulo</p></article>)}</div></>}
      {page==='Veículos' && <>
        <div className="toolbar">{['administrador','operador'].includes(role)&&<button className="primary" onClick={()=>{setEditing(null);setForm(emptyVehicle);setFormOpen(true)}}>+ Cadastrar veículo</button>}<button className="secondary" onClick={loadVehicles}>Atualizar lista</button><button className="secondary" onClick={exportCsv} disabled={!visibleRows.length}>Exportar CSV</button><input placeholder="Pesquisar placa, modelo, condutor..." value={search} onChange={e=>setSearch(e.target.value)}/><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="todos">Todos os veículos</option><option value="carros">Carros</option><option value="motos_empresa">Motos da empresa</option><option value="motos_alugadas">Motos alugadas</option><option value="todas_motos">Todas as motos</option></select></div>
        {message&&<p className="message">{message}</p>}
        {loading?<p>Carregando veículos...</p>:<div className="table-wrap"><table><thead><tr><th>Placa</th><th>Categoria</th><th>Tipo de vínculo</th><th>Modelo</th><th>Localidade</th><th>Condutor</th><th>Status</th><th>Ações</th></tr></thead><tbody>{visibleRows.map(v=><tr key={v.id}><td><b>{v.plate}</b></td><td>{v.category}</td><td>{ownershipLabels[v.ownership_group]}</td><td>{v.model||'—'}</td><td>{v.city||'—'}</td><td>{v.driver_name||'—'}</td><td><span className={`status ${v.status==='inativo'?'inativo':''}`}>{v.status}</span></td><td>{['administrador','operador'].includes(role)&&<button className="secondary" onClick={()=>openEdit(v)}>Editar</button>} {role==='administrador'&&<button className="danger" onClick={()=>deleteVehicle(v)}>Excluir</button>}</td></tr>)}</tbody></table>{!visibleRows.length&&<div className="empty">{rows.length?'Nenhum resultado para esse filtro.':'Nenhum veículo cadastrado.'}</div>}</div>}
      </>}
      {page!=='Visão geral'&&page!=='Veículos'&&<section className="panel"><h2>{page}</h2><p>Este módulo será desenvolvido na próxima etapa.</p></section>}
      {formOpen&&<div className="modal"><form className="vehicle-form" onSubmit={saveVehicle}><h2>{editing?'Editar veículo':'Cadastrar veículo'}</h2><p className="hint">Preencha os dados disponíveis. Placa é obrigatória.</p><div className="form-grid">
        <label>Placa *<input required maxLength={7} value={form.plate} onChange={e=>changeField('plate',cleanPlate(e.target.value))} placeholder="ABC1D23"/></label>
        <label>Categoria<select value={form.category} onChange={e=>changeField('category',e.target.value)}><option value="carro">Carro</option><option value="moto">Moto</option></select></label>
        <label>Tipo de vínculo<select value={form.ownership_group} onChange={e=>changeField('ownership_group',e.target.value)}><option value="carro">Carro</option><option value="moto_empresa">Moto da empresa</option><option value="moto_alugada_funcionario">Moto alugada por funcionário</option></select></label>
        <label>Modelo<input value={form.model} onChange={e=>changeField('model',e.target.value)}/></label>
        <label>Renavam<input value={form.renavam} onChange={e=>changeField('renavam',e.target.value)}/></label>
        <label>Chassi<input value={form.chassis} onChange={e=>changeField('chassis',e.target.value)}/></label>
        <label>Localidade<input value={form.city} onChange={e=>changeField('city',e.target.value)}/></label>
        <label>Condutor<input value={form.driver_name} onChange={e=>changeField('driver_name',e.target.value)}/></label>
        <label>Status<select value={form.status} onChange={e=>changeField('status',e.target.value)}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label>
      </div>{message&&<p className="message">{message}</p>}<div className="actions"><button type="button" className="secondary" onClick={()=>setFormOpen(false)}>Cancelar</button><button className="primary" disabled={saving}>{saving?'Salvando...':'Salvar veículo'}</button></div></form></div>}
    </main>
  </div>;
}
