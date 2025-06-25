/** 
 * Trabajo presentado por: Sebastián Mazo Vélez, Ever Alexander Cano Luján, Juan Pablo Pulido González
*/

// script_analisis_riesgo_crediticio.js
// almacenamiento global de datos
let allData = [];

// Creamos el tooltip
tooltip = d3.select("body")
  .append("div")
    .attr("class", "tooltip");

// Función genérica para crear paneles de gráficas
function createChartPanel(parentSelector, panelId, cfg = {}) {
  const {
    width  = 400,
    height = 300,
    margin = { top: 20, right: 20, bottom: 30, left: 40 }
  } = cfg;

  // Elimina el panel anterior si existe
  d3.select(parentSelector).select(`#${panelId}`).remove();

  // Crea contenedor div y SVG interno
  const container = d3.select(parentSelector)
    .append("div")
      .attr("class", "chart-panel")
      .attr("id", panelId);

  const svg = container.append("svg")
      .attr("width",  width  + margin.left + margin.right)
      .attr("height", height + margin.top  + margin.bottom)
    .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

  return { svg, inner: { width, height } };
}

// Carga y transformación inicial de datos
const parseDate       = d3.timeParse("%m/%d/%Y");
const formatMonthName = d3.timeFormat("%B");

d3.csv("dataset_sintetico_creditos.csv", row => {
  const date = parseDate(row.FechaControl);
  row.FechaControl = date;
  row.Mes         = formatMonthName(date);
  // extraer nivel de riesgo sin letra inicial
  row.Nivel_Riesgo = row.Nivel_Riesgo.split(".")[1].trim();
  return row;
})
.then(raw => {
  allData = raw;
  initFilters(raw);
  updateDashboard(raw);
})
.catch(err => console.error(err));

// Inicializa los desplegables de filtros
function initFilters(data) {
  const meses        = Array.from(new Set(data.map(d => d.Mes)));
  const departamentos= Array.from(new Set(data.map(d => d.Departamento))).sort();
  const tipos        = Array.from(new Set(data.map(d => d.Tipo_credito))).sort();

  // Ordena meses cronológicamente
  const parseMon = d3.timeParse("%B");
  meses.sort((a,b) => parseMon(a) - parseMon(b));

  function poblar(selectId, values) {
    d3.select(selectId)
      .selectAll("option")
      .data(["Todos", ...values])
      .join("option")
        .attr("value", d => d)
        .text(d => d);
  }

  poblar("#sel-mes", meses);
  poblar("#sel-depto", departamentos);
  poblar("#sel-tipo", tipos);

  // Manejador de cambios en any filtro
  d3.selectAll("#sel-mes, #sel-depto, #sel-tipo")
    .on("change", () => {
      let filtered = allData;
      const selMes   = d3.select("#sel-mes").property("value");
      const selDepto = d3.select("#sel-depto").property("value");
      const selTipo  = d3.select("#sel-tipo").property("value");

      if (selMes   !== "Todos") filtered = filtered.filter(d => d.Mes === selMes);
      if (selDepto !== "Todos") filtered = filtered.filter(d => d.Departamento === selDepto);
      if (selTipo  !== "Todos") filtered = filtered.filter(d => d.Tipo_credito === selTipo);

      updateDashboard(filtered);
    });
}

// Dibuja o redibuja los paneles con datos filtrados
function updateDashboard(data) {
 // ------ Panel 1: Distribución de Altura de Mora ------
  const m1 = { top:40, right:20, bottom:40, left:100 };
  const w1 = 600 - m1.left - m1.right;
  const h1 = 300 - m1.top  - m1.bottom;
  const { svg: svg1, inner: i1 } = createChartPanel("#dashboard","dist_altura_mora",{ width:w1, height:h1, margin:m1 });

  const keys1 = ["A. Al dia","B. 1 - 30 dias","C. 31 - 60 dias","D. Mayor a 60 dias"];
  const color1 = d3.scaleOrdinal().domain(keys1).range(["#4C566A","#5E81AC","#88C0D0","#A3BE8C"]);
  const rollup1 = Array.from(
    d3.rollup(data, v => v.length, d => d.Mes, d => d.RDiasMora),
    ([Mes, mapCat]) => {
      const total = d3.sum(mapCat.values());
      const obj = { Mes };
      keys1.forEach(k => { obj[k] = (mapCat.get(k) || 0) / total; });
      return obj;
    }
  );
  const series1 = d3.stack().keys(keys1).offset(d3.stackOffsetExpand)(rollup1);
  const y1 = d3.scaleBand().domain(rollup1.map(d => d.Mes)).range([0, i1.height]).padding(0.2);
  const x1 = d3.scaleLinear().domain([0,1]).range([0, i1.width]);
  svg1.append("g").call(d3.axisLeft(y1));
  svg1.append("g").attr("transform", `translate(0, ${i1.height})`).call(d3.axisBottom(x1).tickFormat(d3.format(".0%")));

  svg1.selectAll("g.layer").data(series1).join("g").attr("class","layer").attr("fill", d => color1(d.key))
    .selectAll("rect").data(d => d).join("rect")
      .attr("y", d => y1(d.data.Mes))
      .attr("x", d => x1(d[0]))
      .attr("width", d => x1(d[1]) - x1(d[0]))
      .attr("height", y1.bandwidth())
      .on("mouseover", (event, d) => {
        const porcentaje = d3.format(".0%")((d[1] - d[0]));
        const categoria = d3.select(event.currentTarget.parentNode).datum().key;
        tooltip.html(`<strong>${categoria}</strong><br/>${porcentaje}`).classed("visible", true);
      })
      .on("mousemove", (event) => tooltip.style("top", (event.pageY + 10) + "px").style("left", (event.pageX + 10) + "px"))
      .on("mouseout", () => tooltip.classed("visible", false));

  const legend1 = svg1.append("g").attr("transform", `translate(${i1.width/10}, -5)`);
  keys1.forEach((k,i) => {
    const g = legend1.append("g").attr("transform", `translate(${i*100}, 0)`);
    g.append("rect").attr("width", 15).attr("height", 15).attr("fill", color1(k));
    g.append("text").attr("x", 20).attr("y", 12).text(k).style("font-size","12px");
  });
  svg1.append("text").attr("x", i1.width/2).attr("y", -20).attr("text-anchor","middle").style("font-size","16px").text("Distribución de Altura de Mora por Mes (%)");
  svg1.append("text").attr("x", i1.width/2).attr("y", i1.height + 35).attr("text-anchor","middle").text("% Cantidad - Edad de Mora");

  // ------ Panel 2: Porcentaje de deterioro ------
  const m2 = { top:40, right:20, bottom:40, left:60 };
  const w2 = 600 - m2.left - m2.right;
  const h2 = 300 - m2.top  - m2.bottom;
  const { svg: svg2, inner: i2 } = createChartPanel("#dashboard","pct_deterioro_mora",{ width:w2, height:h2, margin:m2 });

  const keys2 = ["Buenos","Malos"];
  const color2 = d3.scaleOrdinal().domain(keys2).range(["#A3BE8C","pink"]);
  const rollup2 = Array.from(
    d3.rollup(data, v => v.length, d => d.RDiasMora, d => d.INDBYM),
    ([RDiasMora, mapInd]) => {
      const total = d3.sum(mapInd.values());
      const obj = { RDiasMora };
      keys2.forEach(k => { obj[k] = (mapInd.get(k) || 0) / total; });
      return obj;
    }
  );
  const series2 = d3.stack().keys(keys2).offset(d3.stackOffsetExpand)(rollup2);
  const x2 = d3.scaleBand().domain(rollup2.map(d => d.RDiasMora)).range([0, i2.width]).padding(0.2);
  const y2 = d3.scaleLinear().domain([0,1]).range([i2.height, 0]);
  svg2.append("g").call(d3.axisLeft(y2).tickFormat(d3.format(".0%")));
  svg2.append("g").attr("transform", `translate(0, ${i2.height})`).call(d3.axisBottom(x2));
  svg2.selectAll("g.layer").data(series2).join("g").attr("class","layer").attr("fill", d => color2(d.key))
    .selectAll("rect").data(d => d).join("rect")
      .attr("x", d => x2(d.data.RDiasMora))
      .attr("y", d => y2(d[1]))
      .attr("width", x2.bandwidth())
      .attr("height", d => y2(d[0]) - y2(d[1]))
      .on("mouseover", (event, d) => {
        const porcentaje = d3.format(".0%")((d[1] - d[0]));
        const categoria = d3.select(event.currentTarget.parentNode).datum().key;
        tooltip.html(`<strong>${categoria}</strong><br/>${porcentaje}`).classed("visible", true);
      })
      .on("mousemove", (event) => tooltip.style("top", (event.pageY + 10) + "px").style("left", (event.pageX + 10) + "px"))
      .on("mouseout", () => tooltip.classed("visible", false));
  const legend2 = svg2.append("g").attr("transform", `translate(${i2.width - 325}, -8)`);
  keys2.forEach((k,i) => {
    const g = legend2.append("g").attr("transform", `translate(${i*80}, -10)`);
    g.append("rect").attr("width",15).attr("height",15).attr("fill", color2(k));
    g.append("text").attr("x",20).attr("y",12).text(k).style("font-size","12px");
  });
  svg2.append("text").attr("x", i2.width/2).attr("y", -25).attr("text-anchor","middle").style("font-size","16px").text("Porcentaje de deterioro por Altura de Mora");

  // ------ Panel 3: Evolución ICV por Nivel de Riesgo ------
  const m3 = { top:40, right:100, bottom:40, left:60 };
  const w3 = 600 - m3.left - m3.right;
  const h3 = 300 - m3.top  - m3.bottom;
  const { svg: svg3, inner: i3 } = createChartPanel("#dashboard","icv_evolucion",{ width:w3, height:h3, margin:m3 });

  // Agrupar por nivel de riesgo y mes para calcular ICV
  const rollup3 = d3.rollup(
    data,
    v => ({
      totalMes : d3.sum(v, d=> +d.SaldoCapital),
      totalMora: d3.sum(v.filter(d=> +d.DiasMora>0), d=> +d.SaldoCapital)
    }),
    d => d.Nivel_Riesgo,
    d => d.Mes
  );

  // Aplanar datos
  const icvData = [];
  for (const [nivel, mesMap] of rollup3.entries()) {
    for (const [Mes, vals] of mesMap.entries()) {
      icvData.push({ nivel, Mes, ICV: vals.totalMora/vals.totalMes * 100 });
    }
  }

  // Ordenar meses cronológicamente
  const mesesOrden = Array.from(new Set(icvData.map(d => d.Mes)))
    .sort((a,b) => d3.timeParse("%B")(a) - d3.timeParse("%B")(b));

  // Escalas y ejes
  const x3 = d3.scalePoint().domain(mesesOrden).range([0, i3.width]);
  const y3 = d3.scaleLinear().domain([0, d3.max(icvData, d=> d.ICV)]).nice().range([i3.height, 0]);
  svg3.append("g").attr("transform", `translate(0,${i3.height})`).call(d3.axisBottom(x3));
  svg3.append("g").call(d3.axisLeft(y3));

  // Definir series por nivel
  const niveles = Array.from(new Set(icvData.map(d=> d.nivel)));
  const series3 = niveles.map(nivel => ({
    nivel,
    values: icvData.filter(d=> d.nivel===nivel)
                  .sort((a,b)=> d3.timeParse("%B")(a.Mes)-d3.timeParse("%B")(b.Mes))
  }));

  // Color ordinal
  const color3 = d3.scaleOrdinal(d3.schemeCategory10).domain(niveles);

  // Generador de línea
  const line3 = d3.line()
    .x(d=> x3(d.Mes))
    .y(d=> y3(d.ICV));

  series3.forEach(s => {
    // línea
    svg3.append("path")
      .datum(s.values)
      .attr("fill","none")
      .attr("stroke", color3(s.nivel))
      .attr("stroke-width", 2)
      .attr("d", line3);

    // puntos
    svg3.selectAll(`.dot-${s.nivel}`)
      .data(s.values)
      .enter().append("circle")
        .attr("cx", d=> x3(d.Mes))
        .attr("cy", d=> y3(d.ICV))
        .attr("r", 4)
        .attr("fill","white")
        .attr("stroke", color3(s.nivel))
        .attr("stroke-width", 2)
        .on("mouseover", (event,d) => {
          tooltip.html(`Nivel: ${s.nivel}<br>Mes: ${d.Mes}<br>ICV: ${d.ICV.toFixed(2)}%`).classed("visible", true);
        })
        .on("mousemove", (event) => tooltip.style("top", (event.pageY+10)+"px").style("left", (event.pageX+10)+"px"))
        .on("mouseout", () => tooltip.classed("visible", false));
  });

  // Leyenda
  const legend3 = svg3.append("g").attr("transform", `translate(${i3.width-400},-18)`);
  niveles.forEach((n,i) => {
    const g = legend3.append("g").attr("transform", `translate(${i*105}, 0)`);
    g.append("rect").attr("width", 12).attr("height", 12).attr("fill", color3(n));
    g.append("text").attr("x", 15).attr("y", 12).text(n).style("font-size","12px");
  });

  svg3.append("text").attr("x", i3.width/2).attr("y", -28).attr("text-anchor","middle").style("font-size","16px").text("Evolución ICV Mensual por Nivel de Riesgo");

  // ------ Panel 4: Evolución ICV por departamento y Tipo de Credito ------

  // Configuración inicial
  const m4 = { top: 40, right: 50, bottom: 20, left: 50 };
  const w4 = 600;
  const h4 = 300 - m4.top ;

  const { svg: svg4, inner: i4 } = createChartPanel("#dashboard","ev_icv_depto_tcredito",{ width:w4, height:h4, margin:m4 });

       
  // Formatear los datos
  data.forEach(function(d) {
      d.FechaControl = new Date(d.FechaControl); // Convertir fecha
      d.SaldoCapital = +d.SaldoCapital; // Convertir a numérico
      d.DiasMora = +d.DiasMora; // Convertir a numérico
  });

  // 2. CREAR LA GRAFICA             
  // Función para dibujar el gráfico y actualizarlo
  
        
  // Agrupar por mes y calcular ICV   
 const nestedData = d3.group(data, d => d.FechaControl);
 
 // Crear un array para almacenar los datos procesados
 const processedData = [];   

 // Iterar sobre los datos agrupados, aqui calculamos el ICV
 nestedData.forEach((values, month) => {
     const saldoTotalMes = d3.sum(values, d => d.SaldoCapital);
     const saldoEnMora = d3.sum(values.filter(d => d.DiasMora > 0), d => d.SaldoCapital);
     const icv = (saldoEnMora / saldoTotalMes) * 100; // Convertir a porcentaje
     // Agregar el mes y el ICV al array procesado
     processedData.push({ Fecha: new Date(month), ICV: icv, saldoEnMora: saldoEnMora, saldoTotalMes: saldoTotalMes });
 });

 // Ordenar los datos procesados por fecha antes de dibujar la línea para asegurar que se ubiquen correctamente en la linea de tiempo
 processedData.sort((a, b) => a.Fecha - b.Fecha);

 // Configurar escalas
 // Escala para el eje X (Meses)
 const xScale = d3.scaleTime()
 .domain(d3.extent(processedData, d => d.Fecha))
 .range([m4.left, w4 - m4.right]);

 // Escala para el eje Y (ICV)
 const yScale = d3.scaleLinear()
 .domain([0, d3.max(processedData, d => d.ICV) ])
 .range([h4 - m4.bottom, m4.top]);
 
 // Limpieza del gráfico anterior
 //svg.selectAll("*").remove();

 // Agregamos título al gráfico
 svg4.append("text")
     .attr("x", i4.width / 2) // Centrar horizontalmente el texto
     .attr("y", -20) // Posicionarlo ligeramente encima del gráfico
     .attr("text-anchor", "middle") // Centrar el texto
     .style("font-size", "16px") // Tamaño de fuente
     .style("fill", "black") // Color del texto
     .text("Evolución del ICV por Departamento y Tipo de Crédito"); // Texto del título
 
 // Dibujar eje X utilizando la escala de tiempo
 var ejeX = d3.axisBottom(xScale)     
 .ticks(d3.timeMonth.every(1))
 .tickFormat(d3.timeFormat("%B %Y")) // Nombre completo del mes y año;
 svg4.append("g")
 .attr("transform", `translate(0,${h4 - m4.bottom})`)            
 .call(ejeX)
 .selectAll("text")
 .style("font-size", "1.6em");

 // Creamos la línea que representa la evolución el ICV y conecta los puntos del eje X
 const path = svg4.append("path")
 .datum(processedData)
 .attr("fill", "none")
 .attr("stroke", "steelblue")
 .attr("stroke-width", 2)
 .attr("d", d3.line()
     .x(d => xScale(d.Fecha))
     .y(d => yScale(d.ICV))
 );

 // Animar la línea usando stroke-dasharray
 const totalLength = path.node().getTotalLength();
 path
 .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
 .attr("stroke-dashoffset", totalLength)
 .transition()
 .duration(500) // Duración de la animación en milisegundos
 .ease(d3.easeLinear) // Animación suave
 .attr("stroke-dashoffset", 0); // Dibujar la línea

 // Dibujar líneas guía para cada valor del eje x
 svg4.selectAll(".guide-line")
 .data(processedData)
 .enter()
 .append("line")
 .attr("class", "guide-line")
 .attr("x1", d => xScale(d.Fecha))
 .attr("x2", d => xScale(d.Fecha))
 .attr("y1", d => yScale(d.ICV))
 .attr("y2", h4-m4.bottom)
 .attr("stroke", "gray")
 .attr("stroke-dasharray", "2")
 .attr("stroke-width", 1);

 // Crear un formateador de moneda para mostrar el saldo en pesos colombianos que se mostrara en el tooltip
 const currencyFormat = new Intl.NumberFormat("es-CO", {
     style: "currency",
     currency: "COP", // Moneda: Peso colombiano
     minimumFractionDigits: 2, // Mostrar siempre dos decimales
     maximumFractionDigits: 2
 });

 // Tooltip para mostrar información al pasar el mouse
 const tooltip = d3.select("#tooltip4");

 // Etiquetas de puntos
 // Creamos una escala de radio para los puntos
 const radiusScale = d3.scaleLinear()
                     .domain([0, d3.max(processedData, d => d.ICV)]) // Dominio: de 0 al máximo ICV
                     .range([1, 6]); // Rango: puntos más pequeños (4px) a puntos más grandes (15px)

  const colorScale = d3.scaleLinear()
  .domain([0, 50, 100]) // Ajusta los valores según los rangos de tu ICV (0%, 50%, 100%)
  .range(["green", "orange", "red"]); // Colores para el rango
                 
  
 svg4.selectAll(".dot")
     .data(processedData)
     .enter()
     .append("circle")
     .attr("class", "dot")
     .attr("cx", d => xScale(d.Fecha))
     .attr("cy", d => yScale(d.ICV))
     .attr("r", d => radiusScale(d.ICV)) // Usar la escala de radio para el tamaño del punto
     .attr("fill", d => colorScale(d.ICV))
     .on("mouseover", (event, d) => {
         tooltip
             .style("display", "block")
             .style("left", `${event.pageX + 10}px`) // Posición horizontal
             .style("top", `${event.pageY - 30}px`) // Posición vertical
             .html(`
                 <strong>Fecha:</strong> ${d.Fecha.toLocaleDateString()}<br>
                 <strong>ICV:</strong> ${d.ICV.toFixed(2)}%<br>
                 <strong>Saldo Total en Mora:</strong>${currencyFormat.format(d.saldoEnMora.toFixed(2))}<br>
                 <strong>Saldo Total Mensual:</strong>${currencyFormat.format(d.saldoTotalMes.toFixed(2))}<br>
             `); // Contenido del tooltip
     })
     .on("mouseout", () => {
         tooltip.style("display", "none"); // Ocultar el tooltip al salir del mouse
     });

     // Agregar etiquetas de valores
     svg4.selectAll(".label")
     .data(processedData)
     .enter()
     .append("text")
     .attr("class", "label")
     .attr("x", d => xScale(d.Fecha))
     .attr("y", d => yScale(d.ICV) - 10)
     .attr("text-anchor", "middle")
     .style("font-size", "0.9em")
     .style("fill", "black")
     .text(d => d.ICV.toFixed(2) + "%"); // Mostrar el ICV como porcentaje
               
}
