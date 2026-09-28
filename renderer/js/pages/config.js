/**
 * Page: Config
 * Configurações do launcher
 */

import { API } from '../utils/api.js';
import { toast } from '../utils/toast.js';

export async function init({ state, API, toast }) {
  // Settings já carregadas no app.js e aplicadas via applySettingsToUI
  // Aqui só setup do botão salvar (que já está no app.js)
}

export async function render() {
  // Nada especial para renderizar, inputs já populados
}

export default { init, render };