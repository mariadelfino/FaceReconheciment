# ◈ FACESCAN

> **Reconhecimento e análise facial em tempo real direto no navegador, alimentado por visão computacional via OpenRouter AI.**

FACESCAN é uma aplicação web que acessa a câmera do dispositivo, detecta rostos em tempo real usando a API nativa do navegador e, ao comando do usuário, captura um frame e envia para um modelo de visão (LLM multimodal) via [OpenRouter](https://openrouter.ai). O modelo retorna um perfil estruturado com dados públicos da pessoa identificada e uma análise visual do estado emocional, postura, ambiente e iluminação — tudo apresentado em uma interface estilo terminal cyberpunk.

---

## Sumário

- [Demonstração](#demonstração)
- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Estrutura de Arquivos](#estrutura-de-arquivos)
- [Pré-requisitos](#pré-requisitos)
- [Instalação e Configuração](#instalação-e-configuração)
- [Como Usar](#como-usar)
- [Fluxo Técnico Detalhado](#fluxo-técnico-detalhado)
- [API e Modelo de IA](#api-e-modelo-de-ia)
- [Formato de Resposta da IA](#formato-de-resposta-da-ia)
- [Detecção Facial Nativa](#detecção-facial-nativa)
- [Compatibilidade de Navegadores](#compatibilidade-de-navegadores)
- [Segurança e Privacidade](#segurança-e-privacidade)
- [Personalização](#personalização)
- [Limitações Conhecidas](#limitações-conhecidas)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)

---

## Demonstração

```
┌─────────────────────────────────────────────────┐
│  ◈ FACESCAN                    ● CAM  ● API      │
├──────────────────────┬──────────────────────────┤
│                      │  ◈ ALVO CAPTURADO        │
│   [ VISOR AO VIVO ]  │  [ foto capturada ]      │
│                      ├──────────────────────────┤
│  ┌──────────────┐    │  ◈ PARÂMETROS            │
│  │  ID-001      │    │  Detecções: 42           │
│  └──────────────┘    │  Análises:   3           │
│                      ├──────────────────────────┤
│  ⊕ ESCANEAR  ⟳ RESET │  ◈ LOG DO SISTEMA        │
└──────────────────────┴──────────────────────────┘
```

Ao clicar em **ESCANEAR**, um popup exibe o perfil identificado:

```
╔═════════════════════════════════════════════════╗
║  PERFIL IDENTIFICADO              [RESULTADO]   ║
╠══════════╦══════════════════════════════════════╣
║  [foto]  ║  🌐 DADOS NA WEB                    ║
║          ║  Nome / Ocupação / Nascimento        ║
║  85%     ║  Tags: [Alta Conf.] [Tecnologia]    ║
║  CONF.   ╠══════════════════════════════════════╣
║          ║  📡 STATUS ATUAL                    ║
║          ║  Humor / Expressão / Ambiente       ║
╚══════════╩══════════════════════════════════════╝
```

---

## Funcionalidades

### Câmera e Detecção em Tempo Real
- Acesso à webcam via `getUserMedia` com resolução ideal de 1280×720
- Detecção contínua de rostos usando a **FaceDetector API** nativa do navegador (Chrome)
- Exibição de bounding boxes animados sobre cada rosto detectado com ID numérico
- Mira central (crosshair) por rosto detectado
- Badge com contador de rostos ao vivo (`X ROSTO(S)`)
- Linha de scan animada durante o processamento
- Modo fallback com overlay guia quando o `FaceDetector` não está disponível

### Análise por Inteligência Artificial
- Captura do frame atual como JPEG (qualidade 0.85) com espelhamento corrigido
- Envio da imagem em Base64 para modelo multimodal via OpenRouter
- O modelo retorna JSON estruturado com dois blocos de análise:
  - **`web_info`**: Identificação pública — nome, profissão, nacionalidade, nascimento, notoriedade, confiança percentual e tags
  - **`status`**: Análise visual — humor, expressão facial, características físicas, ambiente, iluminação e postura

### Interface e UX
- Tela de configuração que valida e exibe a chave API mascarada antes de iniciar
- Painel de estatísticas de sessão: total de detecções, análises realizadas, rostos no frame atual
- Log de sistema com timestamps, diferenciando mensagens de sucesso, aviso e erro (últimas 50 linhas)
- Preview da última captura no painel lateral
- Loading overlay com 5 etapas visuais de progresso
- Popup de resultado com barra de confiança animada
- Popup fechável por clique fora, botão ✕ ou tecla `Escape`
- Tecla `Enter` na tela de setup inicia o sistema
- Botão de reset de sessão que zera contadores e captura

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                         Navegador                           │
│                                                             │
│  ┌──────────┐    ┌─────────────┐    ┌────────────────────┐ │
│  │  Câmera  │───▶│  FaceDetect │───▶│  Canvas Overlay    │ │
│  │ (WebRTC) │    │  API Nativa │    │  (bounding boxes)  │ │
│  └──────────┘    └─────────────┘    └────────────────────┘ │
│       │                                                     │
│       ▼ ao clicar ESCANEAR                                  │
│  ┌──────────┐                                               │
│  │  Canvas  │ captura frame → Base64 JPEG                   │
│  │ Capture  │                                               │
│  └────┬─────┘                                               │
│       │                                                     │
│       ▼                                                     │
│  ┌────────────────────────────────────┐                     │
│  │         OpenRouter API             │                     │
│  │  POST /api/v1/chat/completions     │                     │
│  │  model: nvidia/nemotron ou gemini  │                     │
│  │  content: [text prompt + image]    │                     │
│  └────────────┬───────────────────────┘                     │
│               │                                             │
│               ▼                                             │
│  ┌────────────────────────┐                                 │
│  │   JSON Parser          │  extrai { web_info, status }   │
│  └────────────┬───────────┘                                 │
│               │                                             │
│               ▼                                             │
│  ┌────────────────────────┐                                 │
│  │   Popup de Resultado   │  renderiza perfil identificado  │
│  └────────────────────────┘                                 │
└─────────────────────────────────────────────────────────────┘
```

A aplicação é **100% client-side** — não há servidor, backend ou banco de dados. Toda a lógica roda no navegador. A única comunicação externa é a chamada à API do OpenRouter.

---

## Estrutura de Arquivos

```
facescan/
├── index.html          # Estrutura HTML completa da aplicação
├── css/
│   └── styles.css      # Todos os estilos, animações e layout
├── js/
│   └── app.js          # Lógica principal (IIFE App)
└── config/
    └── config.js       # Chave API e modelo (NÃO commitar com chave real)
```

### `index.html`
Contém três telas principais:
- **`#setup-screen`** — tela inicial com validação da chave API
- **`#app-screen`** — interface principal com câmera e painel lateral
- **`#result-popup`** — popup modal com o perfil identificado

Além do `#loading-overlay` e do `#capture-canvas` (canvas oculto para captura).

### `js/app.js`
Módulo IIFE que exporta quatro funções públicas para o HTML:

| Função | Chamada por | Descrição |
|---|---|---|
| `App.init()` | Botão "Iniciar Sistema" | Valida API, inicia câmera, muda de tela |
| `App.scanFace()` | Botão "Escanear" | Captura frame e envia para análise |
| `App.resetSession()` | Botão "Reset" | Zera contadores e captura atual |
| `App.closePopup()` | Botão ✕ / Esc / clique fora | Fecha o popup de resultado |

### `config/config.js`
```js
const ENV = {
  OPENROUTER_API_KEY: "sk-or-v1-...",   // Sua chave OpenRouter
  OPENROUTER_MODEL:   "nvidia/nemotron-nano-12b-v2-vl:free",
};
Object.freeze(ENV);
```

> ⚠️ **Nunca suba este arquivo com sua chave real para repositórios públicos.** Adicione `config/config.js` ao `.gitignore`.

---

## Pré-requisitos

- **Navegador**: Google Chrome (recomendado) para suporte completo à `FaceDetector API`
- **Câmera**: Webcam ou câmera frontal no dispositivo
- **Conexão**: Acesso à internet para chamadas à API do OpenRouter
- **Chave API**: Conta gratuita no [OpenRouter](https://openrouter.ai) com uma chave válida
- **Servidor local** (recomendado): Para evitar restrições de CORS e permissões de câmera em `file://`

---

## Instalação e Configuração

### 1. Clone ou baixe o projeto

```bash
git clone https://github.com/seu-usuario/facescan.git
cd facescan
```

### 2. Configure sua chave API

Edite o arquivo `config/config.js`:

```js
const ENV = {
  OPENROUTER_API_KEY: "sk-or-v1-SUA_CHAVE_AQUI",
  OPENROUTER_MODEL:   "nvidia/nemotron-nano-12b-v2-vl:free",
};
Object.freeze(ENV);
```

Você pode obter uma chave gratuitamente em [openrouter.ai/keys](https://openrouter.ai/keys).

### 3. Adicione ao `.gitignore`

```gitignore
config/config.js
```

Crie um `config/config.example.js` com valores fictícios para outros colaboradores:

```js
const ENV = {
  OPENROUTER_API_KEY: "sk-or-v1-SUA_CHAVE_AQUI",
  OPENROUTER_MODEL:   "nvidia/nemotron-nano-12b-v2-vl:free",
};
Object.freeze(ENV);
```

### 4. Sirva com um servidor local

A câmera via `getUserMedia` exige contexto seguro (`https://` ou `localhost`).

**Opção A — Python (sem instalação):**
```bash
python -m http.server 8080
# Acesse: http://localhost:8080
```

**Opção B — Node.js:**
```bash
npx serve .
# Acesse: http://localhost:3000
```

**Opção C — VS Code:**
Instale a extensão **Live Server** e clique em "Go Live".

---

## Como Usar

1. **Abra** a aplicação no navegador (`http://localhost:8080`)
2. **Verifique** se a chave API foi detectada corretamente na tela de setup (aparece mascarada em verde)
3. **Clique** em `◈ INICIAR SISTEMA`
   - O sistema testa a conexão com o OpenRouter
   - Solicita permissão de câmera
   - Inicia a detecção facial em tempo real
4. **Posicione** seu rosto na câmera — uma bounding box aparece ao redor do rosto detectado
5. **Clique** em `⊕ ESCANEAR E IDENTIFICAR` (habilitado apenas quando há rosto detectado)
6. **Aguarde** o processamento (~3-8 segundos dependendo do modelo e conexão)
7. **Veja** o perfil no popup de resultado
8. **Feche** com ✕, `Esc` ou clicando fora do popup
9. **Use** `⟳ RESET` para limpar a sessão e começar novamente

---

## Fluxo Técnico Detalhado

### Inicialização (`App.init`)

```
1. Lê ENV.OPENROUTER_API_KEY do config/config.js
2. Faz uma chamada de teste para o OpenRouter (max_tokens: 5, mensagem "OK")
3. Se OK → atualiza dot de status da API para verde
4. Chama startCamera() → getUserMedia({ video: { width: 1280, height: 720 } })
5. Oculta #setup-screen, exibe #app-screen
6. Chama initFaceDetection()
```

### Detecção Facial (`initFaceDetection` / `runDetectionLoop`)

```
1. Verifica se window.FaceDetector existe
2. Se sim → instancia FaceDetector({ fastMode: false, maxDetectedFaces: 5 })
3. Loop via requestAnimationFrame:
   a. faceDetector.detect(videoElement) → lista de faces com boundingBox
   b. Para cada face: drawFaceBox() no canvas sobreposto
   c. Atualiza badge, stat e botão de scan (habilitado se faces > 0)
4. Se FaceDetector indisponível → runFallbackOverlay() (box estática guia)
```

### Captura e Análise (`App.scanFace`)

```
1. Cria canvas oculto com dimensões do vídeo
2. Desenha frame atual com ctx.scale(-1,1) para corrigir espelhamento
3. canvas.toDataURL("image/jpeg", 0.85) → string Base64
4. Exibe imagem no painel lateral (#target-preview)
5. Mostra loading overlay e inicia etapas visuais
6. Chama analyzeWithGemini(base64)
```

### Chamada à API (`analyzeWithGemini`)

```
POST https://openrouter.ai/api/v1/chat/completions
Headers:
  Authorization: Bearer {apiKey}
  HTTP-Referer: {window.location.href}
  X-Title: FaceScan

Body:
  model: {ENV.OPENROUTER_MODEL}
  max_tokens: 2000
  temperature: 0.2
  messages: [{
    role: "user",
    content: [
      { type: "text", text: <prompt estruturado solicitando JSON> },
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } }
    ]
  }]
```

### Renderização do Resultado (`renderPopup`)

```
1. Extrai { web_info, status } do JSON retornado
2. Exibe foto capturada no popup
3. Anima barra de confiança até confidence_pct%
4. Preenche bloco "Dados na Web": nome, tags, grid de dados, resumo
5. Preenche bloco "Status Atual": humor, expressão, características, ambiente
6. Exibe timestamp da análise
7. Adiciona classe .active ao #result-popup (dispara animação fadeIn)
```

---

## API e Modelo de IA

O projeto usa o **OpenRouter** como gateway para modelos de visão (multimodais). O OpenRouter é compatível com a especificação da API da OpenAI, permitindo trocar de modelo facilmente.

### Modelos recomendados (com suporte a visão)

| Modelo | Custo | Qualidade | Velocidade |
|---|---|---|---|
| `nvidia/nemotron-nano-12b-v2-vl:free` | Gratuito | Boa | Rápida |
| `google/gemini-2.0-flash-exp:free` | Gratuito | Muito boa | Rápida |
| `google/gemini-2.5-pro-preview` | Pago | Excelente | Média |
| `openai/gpt-4o` | Pago | Excelente | Rápida |
| `anthropic/claude-opus-4` | Pago | Excelente | Média |

Para trocar o modelo, edite `config/config.js`:

```js
OPENROUTER_MODEL: "google/gemini-2.0-flash-exp:free",
```

> Todos os modelos listados com `:free` no nome são gratuitos com limites de uso diário.

---

## Formato de Resposta da IA

O sistema instrui o modelo a retornar **exclusivamente JSON válido** sem markdown, seguindo esta estrutura:

```json
{
  "web_info": {
    "identified": true,
    "confidence": "Alta",
    "confidence_pct": 85,
    "name": "Nome Completo",
    "occupation": "Profissão ou cargo",
    "nationality": "Nacionalidade",
    "born": "Data de nascimento ou estimativa",
    "known_for": "Motivo de notoriedade",
    "summary": "Breve biografia ou observação sobre ausência de dados públicos",
    "tags": ["tag1", "tag2", "tag3"]
  },
  "status": {
    "humor": "Calmo | Animado | Cansado | Estressado | Neutro",
    "expressao": "Descrição da expressão facial",
    "caracteristicas": "Cabelo, olhos, pele, idade estimada",
    "ambiente": "Quarto | Escritório | Área externa | Fundo neutro",
    "iluminacao": "Natural | Artificial | Baixa | Boa iluminação",
    "postura": "Centralizado | De lado | Inclinado",
    "tags": ["tag1", "tag2", "tag3"]
  }
}
```

O sistema extrai o JSON com regex (`/\{[\s\S]*\}/`) para tolerar eventuais prefixos de texto e parseia via `JSON.parse`.

### Níveis de confiança

| `confidence` | `confidence_pct` (padrão) | Cor do tag |
|---|---|---|
| `"Alta"` | 88% | Verde |
| `"Média"` | 60% | Amarelo |
| `"Baixa"` | 35% | Vermelho |

---

## Detecção Facial Nativa

O projeto usa a **Shape Detection API** do Chrome — especificamente `window.FaceDetector`.

```js
const detector = new FaceDetector({
  fastMode: false,     // maior precisão
  maxDetectedFaces: 5  // até 5 rostos simultâneos
});

const faces = await detector.detect(videoElement);
// faces[i].boundingBox → { x, y, width, height }
```

### Modo Fallback

Quando o `FaceDetector` não está disponível (Firefox, Safari, Edge), o sistema exibe um overlay guia estático e **habilita o botão de scan direto**, permitindo uso da análise de IA mesmo sem detecção nativa.

### Bounding Box Visual

Cada rosto detectado recebe:
- Retângulo tracejado em ciano com animação pulsante
- 4 cantos sólidos em verde (marcadores de mira)
- Crosshair central
- Label com ID (`ID-001`, `ID-002`...)

---

## Compatibilidade de Navegadores

| Navegador | Câmera | FaceDetector | Análise IA |
|---|---|---|---|
| Chrome 94+ | ✅ | ✅ | ✅ |
| Edge (Chromium) | ✅ | ⚠️ Requer flag | ✅ |
| Firefox | ✅ | ❌ (fallback) | ✅ |
| Safari | ✅ | ❌ (fallback) | ✅ |
| Chrome Android | ✅ | ✅ | ✅ |

> **Recomendação**: Use Google Chrome no desktop para a experiência completa com detecção facial nativa.

Para habilitar no Edge:
```
edge://flags/#enable-experimental-web-platform-features → Enabled
```

---

## Segurança e Privacidade

- **Nenhum dado é salvo** — a aplicação não possui backend, banco de dados ou cookies com dados pessoais
- **Nenhuma imagem é transmitida** para servidores próprios — apenas para a API do OpenRouter, diretamente do navegador
- **A chave API fica no cliente** — isso é intencional para uma aplicação puramente front-end, mas implica que qualquer pessoa com acesso ao código-fonte pode vê-la. Considere as mitigações abaixo para uso em produção
- **Câmera controlada pelo usuário** — o navegador solicita permissão explícita antes de qualquer acesso

### Mitigações para produção

Se for publicar a aplicação:

1. **Backend proxy**: Crie um endpoint no seu servidor que faz a chamada ao OpenRouter, sem expor a chave no front-end
2. **Variáveis de ambiente**: Use ferramentas como Netlify/Vercel com environment variables e um serverless function
3. **Limites de uso**: Configure limites de gasto na sua conta do OpenRouter

---

## Personalização

### Trocar o modelo de IA

Edite `config/config.js`:
```js
OPENROUTER_MODEL: "google/gemini-2.5-pro-preview",
```

### Ajustar qualidade da captura

Em `js/app.js`, linha do `toDataURL`:
```js
// Qualidade entre 0.0 e 1.0 (padrão: 0.85)
const imageData = capture.toDataURL("image/jpeg", 0.92);
```

### Ajustar o prompt da IA

A constante `prompt` dentro de `analyzeWithGemini()` pode ser modificada para:
- Forçar resposta em outro idioma
- Adicionar novos campos ao JSON
- Ajustar o tom ou nível de detalhe da análise
- Incluir contexto adicional (ex: "estamos em um evento corporativo")

### Número máximo de rostos detectados

```js
state.faceDetector = new FaceDetector({
  fastMode: false,
  maxDetectedFaces: 10  // padrão: 5
});
```

### Alterar o tema visual

Todo o design é controlado por variáveis CSS no topo de `css/styles.css`. A versão atual usa paleta roxa:

```css
:root {
  --violet:   #8b5cf6;
  --lavender: #a78bfa;
  --orchid:   #e879f9;
  /* ... */
}
```

---

## Limitações Conhecidas

- **FaceDetector API** ainda é experimental e disponível apenas no Chrome (sem garantia de suporte futuro)
- A **identificação de pessoas públicas** depende dos dados de treinamento do modelo — não é 100% confiável e pode gerar resultados incorretos
- Modelos **gratuitos** do OpenRouter podem ter limites de requisições por minuto ou por dia
- A análise leva em torno de **3 a 10 segundos** dependendo do modelo escolhido e da velocidade da conexão
- Imagens capturadas em **baixa luminosidade** reduzem significativamente a qualidade da análise
- O projeto não implementa **autenticação** — qualquer pessoa com acesso à URL pode usar a chave API configurada

---

## Tecnologias Utilizadas

| Tecnologia | Uso |
|---|---|
| HTML5 / CSS3 / JavaScript ES2020 | Base da aplicação (sem frameworks) |
| WebRTC / `getUserMedia` | Acesso à câmera |
| Shape Detection API (`FaceDetector`) | Detecção facial nativa no Chrome |
| Canvas API | Captura de frame e overlay de bounding boxes |
| OpenRouter API | Gateway para modelos de visão multimodais |
| Google Fonts (Syne, DM Sans, JetBrains Mono) | Tipografia |
| CSS Custom Properties + Glassmorphism | Sistema de design |
| `requestAnimationFrame` | Loop de detecção em tempo real |

---

## Licença

Este projeto é de uso pessoal/educacional. Ao utilizá-lo, você concorda em:
- Não usar para vigilância não autorizada
- Respeitar a privacidade de terceiros
- Cumprir os Termos de Uso do OpenRouter e dos modelos utilizados

---

<div align="center">

**◈ FACESCAN** — Feito com JavaScript puro e visão computacional

</div>