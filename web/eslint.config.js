// Lint del tablero. Además de las reglas recomendadas, marca en el editor
// los casos más comunes de tres trampas de pasar el Python a JS (ver
// dashboard-cusf.MIGRACION.md): el redondeo, las fechas y confundir "no se
// sabe" (null) con cero. El lint no las ve todas (un `if (!x)` con x = 0 pasa):
// lo que asegura que den igual son las pruebas contra la referencia.
import js from "@eslint/js";
import nounsanitized from "eslint-plugin-no-unsanitized";
import globals from "globals";

const FECHA = "Las fechas van como texto AAAA-MM-DD: new Date('2026-03-14') en Argentina da el 13.";
const FECHAS = [
  { selector: "NewExpression[callee.name='Date'][arguments.length>0]", message: FECHA },
  { selector: "CallExpression[callee.object.name='Date'][callee.property.name='parse']", message: FECHA },
  {
    selector: "CallExpression[callee.property.name='toISOString']",
    message: "toISOString() es la hora de Londres: después de las 21 h en Argentina da la fecha de mañana.",
  },
];
const REDONDEO = "Redondea distinto que Python (12.5 → 13; Python da 12): usar las funciones de formato.js.";
const NUMEROS = [
  { selector: "CallExpression[callee.object.name='Math'][callee.property.name='round']", message: REDONDEO },
  { selector: "CallExpression[callee.property.name='toFixed']", message: REDONDEO },
  { selector: "CallExpression[callee.property.name='toLocaleString']", message: REDONDEO },
  { selector: "MemberExpression[object.name='Intl'][property.name='NumberFormat']", message: REDONDEO },
];
const CERO = "`x || '—'` trata el 0 como si faltara el dato: usar `x ?? '—'` (o comparar con null).";
const SIN_DATOS = [
  { selector: "LogicalExpression[operator='||'][right.type=/^(Literal|TemplateLiteral)$/]", message: CERO },
  { selector: "AssignmentExpression[operator='||=']", message: CERO },
];

export default [
  { ignores: ["sitio/vendor/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    plugins: { "no-unsanitized": nounsanitized },
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.browser } },
    rules: {
      // innerHTML / insertAdjacentHTML sólo con lo que arma html`...` (piezas.js), que escapa cada valor
      "no-unsanitized/method": ["error", { escape: { taggedTemplates: ["html"] } }],
      "no-unsanitized/property": ["error", { escape: { taggedTemplates: ["html"] } }],
      // == mezcla null, undefined y 0: justo lo que no se puede confundir
      eqeqeq: ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
      "no-implicit-globals": "error",
      "no-restricted-syntax": ["error", ...FECHAS, ...NUMEROS, ...SIN_DATOS],
    },
  },
  {
    // el único lugar donde se redondea y se da formato a los números (y se prueba contra Python)
    files: ["sitio/js/formato.js"],
    rules: { "no-restricted-syntax": ["error", ...FECHAS, ...SIN_DATOS] },
  },
  {
    files: ["tests/**/*.js", "correr-pruebas.js", "servir.js", "eslint.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
];
