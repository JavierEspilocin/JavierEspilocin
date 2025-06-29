const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const SHIFTS = [
  {index:1, start:'09:00', end:'11:00'},
  {index:2, start:'11:00', end:'13:00'},
  {index:3, start:'16:00', end:'18:00'},
  {index:4, start:'18:00', end:'20:00'},
];

async function fetchJSON(url, options){
  const res = await fetch(url, options);
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

function getWeekRange(date){
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6:1);
  const monday = new Date(d.setDate(diff));
  const saturday = new Date(monday); saturday.setDate(monday.getDate()+5);
  return {start:monday.toISOString().slice(0,10), end:saturday.toISOString().slice(0,10)};
}

async function loadVolunteers(){
  const list = document.getElementById('vol-list');
  list.innerHTML='';
  const vols = await fetchJSON('/api/volunteers');
  vols.forEach(v=>{
    const li = document.createElement('li');
    li.textContent = v.name;
    li.dataset.id = v.id;
    list.appendChild(li);
  });
}

document.getElementById('add-volunteer').addEventListener('submit', async e=>{
  e.preventDefault();
  const name = document.getElementById('vol-name').value.trim();
  if(!name) return;
  await fetchJSON('/api/volunteers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});
  document.getElementById('vol-name').value='';
  loadVolunteers();
});

function createScheduleTable(){
  const loc = document.getElementById('location').value;
  const today = new Date();
  const range = getWeekRange(today);
  const container = document.getElementById('schedule');
  container.innerHTML='';
  const table = document.createElement('table');
  const header = document.createElement('tr');
  header.appendChild(document.createElement('th')); // corner cell
  DAYS.forEach(d=>{ const th=document.createElement('th'); th.textContent=d; header.appendChild(th); });
  table.appendChild(header);
  SHIFTS.forEach(s=>{
    const tr = document.createElement('tr');
    const tdLabel = document.createElement('td');
    tdLabel.textContent = `${s.start} - ${s.end}`;
    tr.appendChild(tdLabel);
    for(let i=0;i<6;i++){
      const td = document.createElement('td');
      const cell = document.getElementById('shift-cell-template').content.cloneNode(true);
      cell.querySelector('.shift-time').textContent = '';
      const assignBtn = cell.querySelector('.assign-btn');
      const assignment = cell.querySelector('.assignment');
      const date = new Date(range.start); date.setDate(date.getDate()+i);
      td.dataset.date = date.toISOString().slice(0,10);
      td.dataset.shiftIndex = s.index;
      assignBtn.addEventListener('click', ()=>openAssignDialog(loc,td.dataset.date,s,assignment));
      td.appendChild(cell);
      tr.appendChild(td);
      loadAssignment(loc,td.dataset.date,s.index,assignment);
    }
    table.appendChild(tr);
  });
  container.appendChild(table);
}

async function loadAssignment(location,date,shiftIndex,el){
  const {start,end} = getWeekRange(date); // limit query
  const shifts = await fetchJSON(`/api/shifts?location=${location}&start=${start}&end=${end}`);
  const entry = shifts.find(s=>s.date===date && s.shift_index===shiftIndex);
  el.textContent = entry && entry.volunteer_id ? `ID ${entry.volunteer_id}` : 'Vacante';
}

async function openAssignDialog(location,date,shift,sEl){
  const preferred = await fetchJSON(`/api/preferred_volunteers?location=${location}&shift_index=${shift.index}`);
  const vols = preferred.length ? preferred : await fetchJSON('/api/volunteers');
  const name = prompt('Seleccione voluntario\n'+vols.map(v=>`${v.id}: ${v.name}`).join('\n'));
  const vol = vols.find(v=>String(v.id)===name);
  if(!vol) return;
  try{
    await fetchJSON('/api/assign',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({volunteer_id:vol.id,location,date,shift_index:shift.index,start_time:shift.start,end_time:shift.end})});
    sEl.textContent = vol.name;
  }catch(err){
    alert(err);
  }
}

window.addEventListener('load',()=>{
  loadVolunteers();
  document.getElementById('location').addEventListener('change',createScheduleTable);
  createScheduleTable();
});
