import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

const infantSizes = Array.from({ length: 9 }, (_, i) => 25 + i);
const adultSizes = Array.from({ length: 11 }, (_, i) => 34 + i);
const allSizes = Array.from({ length: 20 }, (_, i) => 25 + i);

const getToday = () => new Date().toISOString().slice(0, 10);

const initialBase = allSizes.map((size) => ({
  size,
  initial:
    size <= 33 ? Math.max(4, 18 - (33 - size)) : Math.max(6, 22 - (44 - size)),
  min: size <= 33 ? 8 : 12,
}));

const sumMap = (m = {}) =>
  Object.values(m).reduce((a, v) => a + (Number(v) || 0), 0);

const filterPositiveMap = (m = {}) =>
  Object.fromEntries(
    Object.entries(m).filter(([, v]) => Number(v) > 0)
  );

const formatQtyMap = (m = {}) => {
  const entries = Object.entries(m).filter(([, v]) => Number(v) > 0);
  if (!entries.length) return "—";

  return entries
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([size, qty]) => `${size}: ${qty}`)
    .join(" • ");
};

const getStatus = (current, minimum, pending) =>
  current < minimum ? (pending > 0 ? "Em pedido" : "Comprar") : "OK";

const statusClasses = (status) =>
  status === "Comprar"
    ? "status status-red"
    : status === "Em pedido"
    ? "status status-yellow"
    : "status status-green";

const emptyOrder = () => ({
  id: null,
  date: getToday(),
  supplier: "",
  note: "",
  ped: {},
});

const emptyEntry = () => ({
  id: null,
  date: getToday(),
  supplier: "",
  note: "",
  qty: {},
  order_id: "",
});

const emptyOutput = () => ({
  id: null,
  date: getToday(),
  note: "",
  qty: {},
});

const Card = ({ title, children, right }) => (
  <div className="card">
    {(title || right) && (
      <div className="card-header">
        <h3>{title}</h3>
        {right}
      </div>
    )}
    <div className="card-body">{children}</div>
  </div>
);

const MetricCard = ({ title, value, hint, className = "" }) => (
  <div className={`metric-card ${className}`}>
    <div className="metric-title">{title}</div>
    <div className="metric-value">{value}</div>
    <div className="metric-hint">{hint}</div>
  </div>
);

const InputField = (props) => (
  <input {...props} className={`input ${props.className || ""}`} />
);

const SelectField = (props) => (
  <select {...props} className={`input ${props.className || ""}`} />
);

const ProgressBar = ({ value, className = "" }) => (
  <div className="progress-track">
    <div
      className={`progress-bar ${className}`}
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
);

const TabButton = ({ active, onClick, children }) => (
  <button onClick={onClick} className={`tab-button ${active ? "tab-active" : ""}`}>
    {children}
  </button>
);

const SizeGrid = ({ title, sizes, values, editable = false, onChange }) => (
  <Card title={title}>
    <div className="size-grid">
      {sizes.map((size) => (
        <div key={size} className="size-box">
          <div className="size-label">Nº {size}</div>
          {editable ? (
            <InputField
              type="number"
              min="0"
              value={values[size] ?? ""}
              onChange={(e) => onChange(size, e.target.value)}
            />
          ) : (
            <div className="size-value">{values[size] || 0}</div>
          )}
        </div>
      ))}
    </div>
  </Card>
);

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null);

  const [base, setBase] = useState(initialBase);
  const [orders, setOrders] = useState([]);
  const [entries, setEntries] = useState([]);
  const [outputs, setOutputs] = useState([]);

  const [search, setSearch] = useState("");

  const [newOrder, setNewOrder] = useState(emptyOrder());
  const [newEntry, setNewEntry] = useState(emptyEntry());
  const [newOutput, setNewOutput] = useState(emptyOutput());

  const showBanner = (type, text) => {
    setBanner({ type, text });
    setTimeout(() => setBanner(null), 3000);
  };

  useEffect(() => {
    async function carregarDados() {
      setLoading(true);

      const [
        { data: ordersData, error: ordersError },
        { data: entriesData, error: entriesError },
        { data: outputsData, error: outputsError },
        { data: baseData, error: baseError },
      ] = await Promise.all([
        supabase.from("orders").select("*").order("id", { ascending: false }),
        supabase.from("entries").select("*").order("id", { ascending: false }),
        supabase.from("outputs").select("*").order("id", { ascending: false }),
        supabase.from("base").select("*").order("size", { ascending: true }),
      ]);

      if (!ordersError && ordersData) setOrders(ordersData);
      if (!entriesError && entriesData) setEntries(entriesData);
      if (!outputsError && outputsData) setOutputs(outputsData);
      if (!baseError && baseData && baseData.length > 0) setBase(baseData);

      if (ordersError || entriesError || outputsError || baseError) {
        console.log("ERRO AO CARREGAR:", {
          ordersError,
          entriesError,
          outputsError,
          baseError,
        });
        showBanner("error", "Alguns dados não puderam ser carregados.");
      }

      setLoading(false);
    }

    carregarDados();
  }, []);

  const entriesLinkedToOrders = useMemo(
    () => entries.filter((entry) => entry.order_id !== null && entry.order_id !== undefined),
    [entries]
  );

  const stockRows = useMemo(() => {
    return allSizes.map((size) => {
      const b = base.find((i) => i.size === size) || { initial: 0, min: 0 };

      const received = entries.reduce(
        (a, e) => a + (Number(e.qty?.[size]) || 0),
        0
      );

      const ordered = orders.reduce(
        (a, o) => a + (Number(o.ped?.[size]) || 0),
        0
      );

      const receivedFromOrders = entriesLinkedToOrders.reduce(
        (a, e) => a + (Number(e.qty?.[size]) || 0),
        0
      );

      const pending = Math.max(0, ordered - receivedFromOrders);

      const consumed = outputs.reduce(
        (a, o) => a + (Number(o.qty?.[size]) || 0),
        0
      );

      const current = Number(b.initial || 0) + received - consumed;
      const future = current + pending;
      const minimum = Number(b.min || 0);
      const status = getStatus(current, minimum, pending);

      return {
        size,
        initial: Number(b.initial || 0),
        minimum,
        received,
        ordered,
        pending,
        consumed,
        current,
        future,
        status,
        isCritical: current < minimum,
      };
    });
  }, [base, orders, entries, entriesLinkedToOrders, outputs]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return stockRows;
    return stockRows.filter((r) => String(r.size).includes(search.trim()));
  }, [search, stockRows]);

  const totals = useMemo(
    () => ({
      current: stockRows.reduce((a, b) => a + b.current, 0),
      pending: stockRows.reduce((a, b) => a + b.pending, 0),
      future: stockRows.reduce((a, b) => a + b.future, 0),
      consumed: stockRows.reduce((a, b) => a + b.consumed, 0),
      received: stockRows.reduce((a, b) => a + b.received, 0),
      belowMin: stockRows.filter((r) => r.current < r.minimum).length,
    }),
    [stockRows]
  );

  const infantRows = stockRows.filter((r) => r.size <= 33);
  const adultRows = stockRows.filter((r) => r.size >= 34);
  const maxCurrent = Math.max(...stockRows.map((r) => r.current), 1);

  const purchaseSuggestions = useMemo(() => {
    return stockRows
      .filter((row) => row.future < row.minimum)
      .map((row) => ({
        ...row,
        suggested: row.minimum - row.future,
      }));
  }, [stockRows]);

  const orderStats = useMemo(() => {
    const stats = {};

    orders.forEach((order) => {
      const linkedEntries = entries.filter((entry) => Number(entry.order_id) === Number(order.id));

      const totalOrdered = sumMap(order.ped);
      const totalReceived = linkedEntries.reduce((acc, entry) => acc + sumMap(entry.qty), 0);
      const totalPending = Math.max(0, totalOrdered - totalReceived);

      stats[order.id] = {
        totalOrdered,
        totalReceived,
        totalPending,
        progress: totalOrdered ? (totalReceived / totalOrdered) * 100 : 0,
      };
    });

    return stats;
  }, [orders, entries]);

  const movementHistory = useMemo(() => {
    const orderMovements = orders.map((order) => ({
      id: `order-${order.id}`,
      date: order.date,
      type: "Pedido",
      source: order.supplier || "Sem fornecedor",
      note: order.note || "Sem observação",
      total: sumMap(order.ped),
      detail: formatQtyMap(order.ped),
    }));

    const entryMovements = entries.map((entry) => ({
      id: `entry-${entry.id}`,
      date: entry.date,
      type: "Entrada",
      source: entry.supplier || "Sem fornecedor",
      note: entry.note || "Sem observação",
      total: sumMap(entry.qty),
      detail: formatQtyMap(entry.qty),
    }));

    const outputMovements = outputs.map((output) => ({
      id: `output-${output.id}`,
      date: output.date,
      type: "Saída",
      source: "Produção",
      note: output.note || "Sem observação",
      total: sumMap(output.qty),
      detail: formatQtyMap(output.qty),
    }));

    return [...orderMovements, ...entryMovements, ...outputMovements].sort((a, b) => {
      if (a.date === b.date) return a.type.localeCompare(b.type);
      return b.date.localeCompare(a.date);
    });
  }, [orders, entries, outputs]);

  const addOrder = async () => {
    if (!newOrder.supplier.trim()) {
      showBanner("error", "Informe o fornecedor do pedido.");
      return;
    }

    if (sumMap(newOrder.ped) === 0) {
      showBanner("error", "Informe alguma quantidade no pedido.");
      return;
    }

    const cleaned = {
      date: newOrder.date,
      supplier: newOrder.supplier.trim(),
      note: newOrder.note.trim(),
      ped: filterPositiveMap(newOrder.ped),
    };

    if (newOrder.id) {
      const { data, error } = await supabase
        .from("orders")
        .update(cleaned)
        .eq("id", newOrder.id)
        .select();

      if (!error && data) {
        setOrders((prev) => prev.map((o) => (o.id === newOrder.id ? data[0] : o)));
        setNewOrder(emptyOrder());
        showBanner("success", "Pedido atualizado com sucesso.");
      } else {
        console.log("ERRO AO ATUALIZAR PEDIDO:", error);
        showBanner("error", "Erro ao atualizar pedido.");
      }
      return;
    }

    const { data, error } = await supabase.from("orders").insert([cleaned]).select();

    if (!error && data) {
      setOrders((prev) => [data[0], ...prev]);
      setNewOrder(emptyOrder());
      showBanner("success", "Pedido salvo com sucesso.");
    } else {
      console.log("ERRO AO SALVAR PEDIDO:", error);
      showBanner("error", "Erro ao salvar pedido.");
    }
  };

  const addEntry = async () => {
    if (sumMap(newEntry.qty) === 0) {
      showBanner("error", "Informe alguma quantidade na entrada.");
      return;
    }

    const cleaned = {
      date: newEntry.date,
      supplier: newEntry.supplier.trim(),
      note: newEntry.note.trim(),
      qty: filterPositiveMap(newEntry.qty),
      order_id: newEntry.order_id ? Number(newEntry.order_id) : null,
    };

    if (newEntry.id) {
      const { data, error } = await supabase
        .from("entries")
        .update(cleaned)
        .eq("id", newEntry.id)
        .select();

      if (!error && data) {
        setEntries((prev) => prev.map((e) => (e.id === newEntry.id ? data[0] : e)));
        setNewEntry(emptyEntry());
        showBanner("success", "Entrada atualizada com sucesso.");
      } else {
        console.log("ERRO AO ATUALIZAR ENTRADA:", error);
        showBanner("error", "Erro ao atualizar entrada.");
      }
      return;
    }

    const { data, error } = await supabase.from("entries").insert([cleaned]).select();

    if (!error && data) {
      setEntries((prev) => [data[0], ...prev]);
      setNewEntry(emptyEntry());
      showBanner("success", "Entrada salva com sucesso.");
    } else {
      console.log("ERRO AO SALVAR ENTRADA:", error);
      showBanner("error", "Erro ao salvar entrada.");
    }
  };

  const addOutput = async () => {
    if (!newOutput.note.trim() && sumMap(newOutput.qty) === 0) {
      showBanner("error", "Informe uma observação ou uma quantidade de saída.");
      return;
    }

    const cleaned = {
      date: newOutput.date,
      note: newOutput.note.trim(),
      qty: filterPositiveMap(newOutput.qty),
    };

    if (newOutput.id) {
      const { data, error } = await supabase
        .from("outputs")
        .update(cleaned)
        .eq("id", newOutput.id)
        .select();

      if (!error && data) {
        setOutputs((prev) => prev.map((o) => (o.id === newOutput.id ? data[0] : o)));
        setNewOutput(emptyOutput());
        showBanner("success", "Saída atualizada com sucesso.");
      } else {
        console.log("ERRO AO ATUALIZAR SAÍDA:", error);
        showBanner("error", "Erro ao atualizar saída.");
      }
      return;
    }

    const { data, error } = await supabase.from("outputs").insert([cleaned]).select();

    if (!error && data) {
      setOutputs((prev) => [data[0], ...prev]);
      setNewOutput(emptyOutput());
      showBanner("success", "Saída salva com sucesso.");
    } else {
      console.log("ERRO AO SALVAR SAÍDA:", error);
      showBanner("error", "Erro ao salvar saída.");
    }
  };

  const saveBase = async () => {
    try {
      const { error } = await supabase
        .from("base")
        .upsert(base, { onConflict: "size" });

      if (error) {
        console.log("ERRO AO SALVAR CONFIGURAÇÃO:", error);
        showBanner("error", "Erro ao salvar configuração.");
        return;
      }

      showBanner("success", "Configuração salva com sucesso.");
    } catch (err) {
      console.log("ERRO GERAL AO SALVAR CONFIGURAÇÃO:", err);
      showBanner("error", "Erro ao salvar configuração.");
    }
  };

  const deleteOrder = async (id) => {
    const confirmed = window.confirm("Deseja excluir este pedido?");
    if (!confirmed) return;

    const { error } = await supabase.from("orders").delete().eq("id", id);

    if (!error) {
      setOrders((prev) => prev.filter((order) => order.id !== id));
      if (newOrder.id === id) setNewOrder(emptyOrder());
      showBanner("success", "Pedido excluído com sucesso.");
    } else {
      console.log("ERRO AO EXCLUIR PEDIDO:", error);
      showBanner("error", "Erro ao excluir pedido.");
    }
  };

  const deleteEntry = async (id) => {
    const confirmed = window.confirm("Deseja excluir esta entrada?");
    if (!confirmed) return;

    const { error } = await supabase.from("entries").delete().eq("id", id);

    if (!error) {
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
      if (newEntry.id === id) setNewEntry(emptyEntry());
      showBanner("success", "Entrada excluída com sucesso.");
    } else {
      console.log("ERRO AO EXCLUIR ENTRADA:", error);
      showBanner("error", "Erro ao excluir entrada.");
    }
  };

  const deleteOutput = async (id) => {
    const confirmed = window.confirm("Deseja excluir esta saída?");
    if (!confirmed) return;

    const { error } = await supabase.from("outputs").delete().eq("id", id);

    if (!error) {
      setOutputs((prev) => prev.filter((output) => output.id !== id));
      if (newOutput.id === id) setNewOutput(emptyOutput());
      showBanner("success", "Saída excluída com sucesso.");
    } else {
      console.log("ERRO AO EXCLUIR SAÍDA:", error);
      showBanner("error", "Erro ao excluir saída.");
    }
  };

  const stockTable = (rows) => (
    <div className="table-wrap">
      <table className="stock-table">
        <thead>
          <tr>
            <th>Nº</th>
            <th>Entradas</th>
            <th>Em pedido</th>
            <th>Atual</th>
            <th>Futuro</th>
            <th>Mínimo</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.size} className={r.isCritical ? "row-critical" : ""}>
              <td>
                <strong>{r.size}</strong>
              </td>
              <td className="num">{r.received}</td>
              <td className="num">{r.pending}</td>
              <td className="num">{r.current}</td>
              <td className="num">
                <strong>{r.future}</strong>
              </td>
              <td className="num">{r.minimum}</td>
              <td className="num">
                <span className={statusClasses(r.status)}>{r.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <Card>
            <div className="notice-info">Carregando dados do estoque...</div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <header className="hero">
          <div>
            <p className="eyebrow">Calçados Rock Star</p>
            <div className="hero-brand">
              <img src="/logo-rockstar.png" alt="Rock Star" className="hero-logo" />
              <div>
                <h1>CONTROLE DE SOLADO</h1>
                <p className="subtle">App instalável no celular • branco, vermelho e azul</p>
              </div>
            </div>
          </div>
          <div className="pill">Infantil 25–33 • Adulto 34–44</div>
        </header>

        {banner && (
          <div
            className={banner.type === "success" ? "notice-success" : "notice-error"}
            style={{ marginBottom: "16px" }}
          >
            {banner.text}
          </div>
        )}

        <section className="metrics">
          <MetricCard
            title="Estoque atual"
            value={totals.current}
            hint="Base + entradas - saídas"
            className="metric-green"
          />
          <MetricCard
            title="Entradas"
            value={totals.received}
            hint="Tudo que já entrou"
            className="metric-yellow"
          />
          <MetricCard
            title="Em pedido"
            value={totals.pending}
            hint="O que ainda falta chegar"
            className="metric-blue"
          />
          <MetricCard
            title="Consumido"
            value={totals.consumed}
            hint="Saídas para produção"
            className="metric-red"
          />
          <MetricCard
            title="Abaixo do mínimo"
            value={totals.belowMin}
            hint="Numerações que exigem atenção"
            className="metric-navy"
          />
        </section>

        <nav className="tabs">
          <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")}>
            Dashboard
          </TabButton>
          <TabButton active={tab === "estoque"} onClick={() => setTab("estoque")}>
            Estoque
          </TabButton>
          <TabButton active={tab === "pedidos"} onClick={() => setTab("pedidos")}>
            Pedidos
          </TabButton>
          <TabButton active={tab === "entradas"} onClick={() => setTab("entradas")}>
            Entradas
          </TabButton>
          <TabButton active={tab === "saidas"} onClick={() => setTab("saidas")}>
            Saídas
          </TabButton>
          <TabButton active={tab === "historico"} onClick={() => setTab("historico")}>
            Histórico
          </TabButton>
          <TabButton active={tab === "config"} onClick={() => setTab("config")}>
            Configuração
          </TabButton>
        </nav>

        {tab === "dashboard" && (
          <div className="stack">
            <div className="grid-two">
              <Card title="Estoque infantil" right={<span className="mini-tag tag-yellow">25 a 33</span>}>
                <div className="stack-sm">
                  {infantRows.map((r) => (
                    <div key={r.size} className="mini-card">
                      <div className="row-between">
                        <span>
                          <strong>Nº {r.size}</strong>
                        </span>
                        <span className="muted">
                          {r.current} / mín. {r.minimum}
                        </span>
                      </div>
                      <ProgressBar
                        value={r.minimum ? (r.current / r.minimum) * 100 : 100}
                        className={r.current < r.minimum ? "bar-yellow" : "bar-red"}
                      />
                      <div className="row-between tiny muted">
                        <span>Atual: {r.current}</span>
                        <span>Futuro: {r.future}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Estoque adulto" right={<span className="mini-tag tag-blue">34 a 44</span>}>
                <div className="stack-sm">
                  {adultRows.map((r) => (
                    <div key={r.size} className="mini-card">
                      <div className="row-between">
                        <span>
                          <strong>Nº {r.size}</strong>
                        </span>
                        <span className="muted">
                          {r.current} / mín. {r.minimum}
                        </span>
                      </div>
                      <ProgressBar
                        value={r.minimum ? (r.current / r.minimum) * 100 : 100}
                        className={r.current < r.minimum ? "bar-yellow" : "bar-blue"}
                      />
                      <div className="row-between tiny muted">
                        <span>Atual: {r.current}</span>
                        <span>Futuro: {r.future}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="grid-three">
              <Card title="Distribuição do estoque atual">
                <div className="stack-sm">
                  {stockRows.map((r) => (
                    <div key={r.size}>
                      <div className="row-between small-gap">
                        <span>
                          <strong>Nº {r.size}</strong>
                        </span>
                        <span className="muted">{r.current}</span>
                      </div>
                      <ProgressBar
                        value={(r.current / maxCurrent) * 100}
                        className={r.size <= 33 ? "bar-yellow" : "bar-blue"}
                      />
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Itens com atenção">
                <div className="stack-sm">
                  {stockRows.filter((r) => r.status !== "OK").length === 0 ? (
                    <div className="notice-success">Tudo certo no momento.</div>
                  ) : (
                    stockRows
                      .filter((r) => r.status !== "OK")
                      .map((r) => (
                        <div key={r.size} className="mini-card white">
                          <div>
                            <div>
                              <strong>Numeração {r.size}</strong>
                            </div>
                            <div className="small muted">
                              Atual {r.current} • Futuro {r.future} • Mín. {r.minimum}
                            </div>
                          </div>
                          <span className={statusClasses(r.status)}>{r.status}</span>
                        </div>
                      ))
                  )}
                </div>
              </Card>

              <Card title="Sugestão de compra">
                <div className="stack-sm">
                  {purchaseSuggestions.length === 0 ? (
                    <div className="notice-success">Nenhuma compra necessária agora.</div>
                  ) : (
                    purchaseSuggestions.map((item) => (
                      <div key={item.size} className="mini-card white">
                        <div>
                          <div>
                            <strong>Nº {item.size}</strong>
                          </div>
                          <div className="small muted">
                            Futuro {item.future} • Mín. {item.minimum}
                          </div>
                        </div>
                        <span className="outline-tag">Comprar {item.suggested}</span>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            <Card title="Resumo por numeração">{stockTable(stockRows)}</Card>
          </div>
        )}

        {tab === "estoque" && (
          <div className="stack">
            <Card>
              <InputField
                placeholder="Pesquisar numeração..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Card>
            <Card title="Controle completo">{stockTable(filteredRows)}</Card>
          </div>
        )}

        {tab === "pedidos" && (
          <div className="stack">
            <div className="grid-form">
              <SizeGrid
                title="Pedido de compra"
                sizes={allSizes}
                values={newOrder.ped}
                editable
                onChange={(size, value) =>
                  setNewOrder((prev) => ({
                    ...prev,
                    ped: { ...prev.ped, [size]: Number(value) || 0 },
                  }))
                }
              />

              <Card title={newOrder.id ? "Editar pedido" : "Dados do pedido"}>
                <div className="stack-sm">
                  <InputField
                    type="date"
                    value={newOrder.date}
                    onChange={(e) => setNewOrder((prev) => ({ ...prev, date: e.target.value }))}
                  />

                  <InputField
                    placeholder="Fornecedor"
                    value={newOrder.supplier}
                    onChange={(e) =>
                      setNewOrder((prev) => ({ ...prev, supplier: e.target.value }))
                    }
                  />

                  <InputField
                    placeholder="Observação"
                    value={newOrder.note}
                    onChange={(e) => setNewOrder((prev) => ({ ...prev, note: e.target.value }))}
                  />

                  <div className="small muted">
                    Total pedido: <strong style={{ color: "#0f172a" }}>{sumMap(newOrder.ped)}</strong>
                  </div>

                  <div className="actions">
                    <button className="btn btn-primary" onClick={addOrder}>
                      {newOrder.id ? "Atualizar pedido" : "Salvar pedido"}
                    </button>

                    {newOrder.id && (
                      <button className="btn btn-secondary" onClick={() => setNewOrder(emptyOrder())}>
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            <Card title="Pedidos lançados">
              <div className="stack-sm">
                {orders.length === 0 ? (
                  <div className="notice-info">Nenhum pedido lançado ainda.</div>
                ) : (
                  orders.map((order) => {
                    const stats = orderStats[order.id] || {
                      totalOrdered: 0,
                      totalReceived: 0,
                      totalPending: 0,
                      progress: 0,
                    };

                    return (
                      <div key={order.id} className="item-card">
                        <div className="row-between">
                          <div
                            onClick={() =>
                              setNewOrder({
                                id: order.id,
                                date: order.date,
                                supplier: order.supplier || "",
                                note: order.note || "",
                                ped: { ...(order.ped || {}) },
                              })
                            }
                            style={{ cursor: "pointer", flex: 1 }}
                          >
                            <div>
                              <strong>{order.supplier}</strong>
                            </div>
                            <div className="small muted">
                              {order.date} • {order.note || "Sem observação"}
                            </div>
                          </div>

                          <div className="tag-row">
                            <span className="outline-tag">Pedido {stats.totalOrdered}</span>
                            <span className="outline-tag">Recebido {stats.totalReceived}</span>
                            <span className="outline-tag">Falta {stats.totalPending}</span>
                            <button className="btn btn-secondary" onClick={() => deleteOrder(order.id)}>
                              Excluir
                            </button>
                          </div>
                        </div>

                        <div style={{ marginTop: "10px" }}>
                          <ProgressBar value={stats.progress} className="bar-blue" />
                        </div>

                        <div className="tiny muted" style={{ marginTop: "8px" }}>
                          {formatQtyMap(order.ped)} • Clique no texto para editar
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>
        )}

        {tab === "entradas" && (
          <div className="stack">
            <div className="grid-form">
              <SizeGrid
                title="Lançar entrada"
                sizes={allSizes}
                values={newEntry.qty}
                editable
                onChange={(size, value) =>
                  setNewEntry((prev) => ({
                    ...prev,
                    qty: { ...prev.qty, [size]: Number(value) || 0 },
                  }))
                }
              />

              <Card title={newEntry.id ? "Editar entrada" : "Dados da entrada"}>
                <div className="stack-sm">
                  <InputField
                    type="date"
                    value={newEntry.date}
                    onChange={(e) => setNewEntry((prev) => ({ ...prev, date: e.target.value }))}
                  />

                  <InputField
                    placeholder="Fornecedor"
                    value={newEntry.supplier}
                    onChange={(e) =>
                      setNewEntry((prev) => ({ ...prev, supplier: e.target.value }))
                    }
                  />

                  <InputField
                    placeholder="Observação"
                    value={newEntry.note}
                    onChange={(e) => setNewEntry((prev) => ({ ...prev, note: e.target.value }))}
                  />

                  <SelectField
                    value={newEntry.order_id}
                    onChange={(e) =>
                      setNewEntry((prev) => ({ ...prev, order_id: e.target.value }))
                    }
                  >
                    <option value="">Sem vínculo com pedido</option>
                    {orders.map((order) => (
                      <option key={order.id} value={order.id}>
                        Pedido #{order.id} • {order.supplier}
                      </option>
                    ))}
                  </SelectField>

                  <div className="small muted">
                    Total entrada: <strong>{sumMap(newEntry.qty)}</strong>
                  </div>

                  <div className="actions">
                    <button className="btn btn-primary" onClick={addEntry}>
                      {newEntry.id ? "Atualizar entrada" : "Salvar entrada"}
                    </button>

                    {newEntry.id && (
                      <button className="btn btn-secondary" onClick={() => setNewEntry(emptyEntry())}>
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            <Card title="Entradas lançadas">
              <div className="stack-sm">
                {entries.length === 0 ? (
                  <div className="notice-info">Nenhuma entrada lançada ainda.</div>
                ) : (
                  entries.map((entry) => (
                    <div key={entry.id} className="item-card">
                      <div className="row-between">
                        <div
                          onClick={() =>
                            setNewEntry({
                              id: entry.id,
                              date: entry.date,
                              supplier: entry.supplier || "",
                              note: entry.note || "",
                              qty: { ...(entry.qty || {}) },
                              order_id: entry.order_id ? String(entry.order_id) : "",
                            })
                          }
                          style={{ cursor: "pointer", flex: 1 }}
                        >
                          <div>
                            <strong>{entry.supplier || "Sem fornecedor"}</strong>
                          </div>
                          <div className="small muted">
                            {entry.date} • {entry.note || "Sem observação"}
                          </div>
                          <div className="tiny muted" style={{ marginTop: "6px" }}>
                            {entry.order_id ? `Vinculado ao pedido #${entry.order_id}` : "Sem pedido vinculado"}
                          </div>
                        </div>

                        <div className="tag-row">
                          <div className="outline-tag">Entrada {sumMap(entry.qty)}</div>
                          <button className="btn btn-secondary" onClick={() => deleteEntry(entry.id)}>
                            Excluir
                          </button>
                        </div>
                      </div>

                      <div className="tiny muted" style={{ marginTop: "8px" }}>
                        {formatQtyMap(entry.qty)} • Clique no texto para editar
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {tab === "saidas" && (
          <div className="stack">
            <div className="grid-form">
              <SizeGrid
                title="Lançar saída de produção"
                sizes={allSizes}
                values={newOutput.qty}
                editable
                onChange={(size, value) =>
                  setNewOutput((prev) => ({
                    ...prev,
                    qty: { ...prev.qty, [size]: Number(value) || 0 },
                  }))
                }
              />

              <Card title={newOutput.id ? "Editar saída" : "Dados da saída"}>
                <div className="stack-sm">
                  <InputField
                    type="date"
                    value={newOutput.date}
                    onChange={(e) => setNewOutput((prev) => ({ ...prev, date: e.target.value }))}
                  />

                  <InputField
                    placeholder="Observação da produção"
                    value={newOutput.note}
                    onChange={(e) => setNewOutput((prev) => ({ ...prev, note: e.target.value }))}
                  />

                  <div className="small muted">
                    Total consumido: <strong>{sumMap(newOutput.qty)}</strong>
                  </div>

                  <div className="actions">
                    <button className="btn btn-primary" onClick={addOutput}>
                      {newOutput.id ? "Atualizar saída" : "Salvar saída"}
                    </button>

                    {newOutput.id && (
                      <button className="btn btn-secondary" onClick={() => setNewOutput(emptyOutput())}>
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            <Card title="Saídas lançadas">
              <div className="stack-sm">
                {outputs.length === 0 ? (
                  <div className="notice-info">Nenhuma saída lançada ainda.</div>
                ) : (
                  outputs.map((out) => (
                    <div key={out.id} className="item-card">
                      <div className="row-between">
                        <div
                          onClick={() =>
                            setNewOutput({
                              id: out.id,
                              date: out.date,
                              note: out.note || "",
                              qty: { ...(out.qty || {}) },
                            })
                          }
                          style={{ cursor: "pointer", flex: 1 }}
                        >
                          <div>
                            <strong>{out.note || "Saída sem observação"}</strong>
                          </div>
                          <div className="small muted">{out.date}</div>
                        </div>

                        <div className="tag-row">
                          <div className="outline-tag">Consumido {sumMap(out.qty)}</div>
                          <button className="btn btn-secondary" onClick={() => deleteOutput(out.id)}>
                            Excluir
                          </button>
                        </div>
                      </div>

                      <div className="tiny muted" style={{ marginTop: "8px" }}>
                        {formatQtyMap(out.qty)} • Clique no texto para editar
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {tab === "historico" && (
          <div className="stack">
            <Card title="Histórico de movimentações">
              <div className="stack-sm">
                {movementHistory.length === 0 ? (
                  <div className="notice-info">Nenhuma movimentação encontrada.</div>
                ) : (
                  movementHistory.map((item) => (
                    <div key={item.id} className="item-card">
                      <div className="row-between">
                        <div>
                          <div>
                            <strong>{item.type}</strong> • {item.source}
                          </div>
                          <div className="small muted">
                            {item.date} • {item.note}
                          </div>
                        </div>
                        <div className="tag-row">
                          <span className="outline-tag">Qtd {item.total}</span>
                        </div>
                      </div>

                      <div className="tiny muted" style={{ marginTop: "8px" }}>
                        {item.detail}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {tab === "config" && (
          <Card title="Saldo inicial e mínimo">
            <div className="table-wrap">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th>Saldo inicial</th>
                    <th>Mínimo</th>
                  </tr>
                </thead>
                <tbody>
                  {base.map((row) => (
                    <tr key={row.size}>
                      <td>
                        <strong>{row.size}</strong>
                      </td>
                      <td className="num">
                        <InputField
                          type="number"
                          className="mini-input"
                          value={row.initial}
                          onChange={(e) =>
                            setBase((prev) =>
                              prev.map((item) =>
                                item.size === row.size
                                  ? { ...item, initial: Number(e.target.value) || 0 }
                                  : item
                              )
                            )
                          }
                        />
                      </td>
                      <td className="num">
                        <InputField
                          type="number"
                          className="mini-input"
                          value={row.min}
                          onChange={(e) =>
                            setBase((prev) =>
                              prev.map((item) =>
                                item.size === row.size
                                  ? { ...item, min: Number(e.target.value) || 0 }
                                  : item
                              )
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="actions" style={{ marginTop: "16px" }}>
              <button className="btn btn-primary" onClick={saveBase}>
                Salvar configuração
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}