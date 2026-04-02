<div align="center">

# ◈ FACESCAN

**Sistema de reconhecimento e análise facial em tempo real via browser**

![HTML](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![OpenRouter](https://img.shields.io/badge/OpenRouter-6D28D9?style=for-the-badge&logo=openai&logoColor=white)

> Captura frames da webcam, detecta rostos em tempo real e envia a imagem para um modelo de visão computacional via OpenRouter — retornando um perfil completo com dados de identificação e análise facial.

</div>

---

## Índice

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Arquitetura e Estrutura de Arquivos](#arquitetura-e-estrutura-de-arquivos)
- [Como Funciona — Fluxo Completo](#como-funciona--fluxo-completo)
- [Pré-requisitos](#pré-requisitos)
- [Configuração e Instalação](#configuração-e-instalação)
- [Como Usar](#como-usar)
- [Detalhes Técnicos](#detalhes-técnicos)
- [Interface e Componentes de UI](#interface-e-componentes-de-ui)
- [Resposta da IA — Estrutura JSON](#resposta-da-ia--estrutura-json)
- [Compatibilidade](#compatibilidade)
- [Limitações e Considerações Éticas](#limitações-e-considerações-éticas)
- [Roadmap](#roadmap)

---

## Visão Geral

FaceScan é uma aplicação **100% frontend** — sem backend, sem servidor, sem banco de dados. Toda a inteligência é delegada a modelos de visão da [OpenRouter](https://openrouter.ai), e toda a lógica roda diretamente no browser do usuário.

O sistema opera em dois estágios principais:

1. **Detecção local em tempo real** — usa a API nativa `FaceDetector` do Chrome para identificar rostos no feed da câmera e desenhá-los com bounding boxes animados no canvas.
2. **Análise via IA** — ao acionar o scan, captura o frame atual e envia para um modelo multimodal via OpenRouter, que devolve um perfil estruturado em JSON.

A chave de API nunca sai do dispositivo do usuário — todas as requisições são feitas diretamente do browser para a API do OpenRouter.

---

## Funcionalidades

### Detecção Facial em Tempo Real
- Usa a `FaceDetector API` nativa do Chrome (zero bibliotecas externas)
- Loop de detecção contínuo via `requestAnimationFrame`
- Exibe bounding boxes animados com efeito de pulsação sobre cada rosto detectado
- Desenha marcadores de crosshair no centro de cada rosto
- Contador de rostos atualizado em tempo real (badge no canto do visor)
- Modo fallback automático para browsers sem suporte (overlay de posicionamento manual)

### Captura e Análise via IA
- Captura o frame atual do vídeo com espelhamento corrigido (via canvas)
- Envia a imagem em `base64 JPEG` para o modelo via OpenRouter
- Prompt estruturado em português que força resposta em JSON válido
- Parsing robusto com extração via regex para garantir JSON limpo mesmo com texto extra
- Temperatura baixa (`0.2`) para respostas mais determinísticas e consistentes

### Perfil de Resultado em Dois Blocos
- **DADOS NA WEB**: tentativa de identificação pública (nome, profissão, nacionalidade, data de nascimento, motivo de notoriedade, resumo biográfico, nível de confiança percentual)
- **STATUS ATUAL**: análise do momento capturado (humor aparente, expressão facial, características físicas visíveis, ambiente ao fundo, iluminação, postura e enquadramento)

### UX e Interface
- Barra de progresso em 5 etapas visuais durante a análise
- Sistema de log em tempo real com timestamps no painel lateral
- Preview da imagem capturada no painel lateral
- Popup de resultado com barra de confiança animada (CSS transition 1.2s)
- Atalhos de teclado: `Enter` para iniciar o sistema, `Esc` para fechar popup
- Fechar popup clicando no backdrop externo
- Reset de sessão com limpeza de estatísticas e preview
- Status indicators de câmera e API no header com animação de blink

---

## Arquitetura e Estrutura de Arquivos

```
facescan/
│
├── index.html              # Estrutura HTML completa da SPA
│
├── css/
│   └── styles.css          # Todo o design system, animações e layout
│
├── js/
│   └── app.js              # Lógica principal — IIFE com módulos internos
│
└── config/
    └── config.js           # Variáveis de ambiente (chave API e modelo)
```

O projeto tem **zero dependências de JavaScript externas**. Sem npm, sem webpack, sem framework. Abre direto no browser. As fontes são carregadas via Google Fonts (CDN) no `index.html`.

---

## Como Funciona — Fluxo Completo

```
Usuário abre a página
        │
        ▼
config/config.js é carregado
        │
        ├── ENV.OPENROUTER_API_KEY definida e válida?
        │       │
        │      NÃO → exibe aviso, bloqueia botão de iniciar
        │       │
        │      SIM → exibe chave mascarada, habilita botão
        │
        ▼
Usuário clica em "INICIAR SISTEMA"
        │
        ├── 1. Testa a chave API (requisição mínima de 5 tokens)
        │           Falha → exibe erro, interrompe
        │
        ├── 2. Solicita acesso à câmera (getUserMedia)
        │           Falha → exibe erro, interrompe
        │
        ├── 3. Configura canvas overlay com as dimensões do vídeo
        │
        └── 4. Inicializa FaceDetector
                    │
                    ├── Suportado → inicia loop requestAnimationFrame
                    │
                    └── Não suportado → ativa modo fallback com overlay estático

Loop de Detecção (contínuo)
        │
        ├── FaceDetector.detect(videoElement)
        ├── Para cada rosto detectado:
        │       ├── Desenha bounding box tracejado com pulsação
        │       ├── Desenha cantos de enquadramento (L-shapes)
        │       ├── Desenha crosshair central
        │       └── Renderiza label "ID-001, ID-002..." acima do box
        ├── Atualiza badge de contagem de rostos
        └── Habilita/desabilita botão de scan conforme detecção

Usuário clica em "ESCANEAR E IDENTIFICAR"
        │
        ├── Captura frame → canvas espelhado → toDataURL JPEG 85%
        ├── Exibe preview no painel lateral
        ├── Abre loading overlay com 5 etapas
        │
        └── analyzeWithGemini(base64)
                │
                ├── Etapa 1: Capturando frame
                ├── Etapa 2: Montando e enviando requisição
                │           POST https://openrouter.ai/api/v1/chat/completions
                │           Headers: Authorization Bearer, HTTP-Referer, X-Title
                │           Body: model, max_tokens 2000, temperature 0.2
                │           Content: prompt PT-BR + imagem base64
                ├── Etapa 3: Aguardando resposta do modelo
                ├── Etapa 4: Extraindo e parseando JSON
                └── Etapa 5: Renderizando popup de resultado

Popup de Resultado
        │
        ├── Foto capturada (com borda gradiente)
        ├── Barra de confiança animada
        ├── Bloco "DADOS NA WEB" (web_info)
        └── Bloco "STATUS ATUAL" (status)
```

---

## Pré-requisitos

| Requisito | Detalhe |
|---|---|
| Browser | **Google Chrome** recomendado (necessário para FaceDetector API nativa) |
| Câmera | Webcam ou câmera frontal funcional |
| Conta OpenRouter | Gratuita em [openrouter.ai](https://openrouter.ai) |
| Chave de API OpenRouter | Gerada em [openrouter.ai/keys](https://openrouter.ai/keys) |
| Servidor HTTP local | Para evitar restrições de segurança do browser ao acessar a câmera |

> **Por que servidor local?** Browsers modernos bloqueiam acesso à câmera em páginas abertas via `file://`. Um servidor HTTP local simples resolve isso sem nenhuma configuração extra.

---

## Configuração e Instalação

### 1. Clonar o repositório

```bash
git clone https://github.com/seu-usuario/facescan.git
cd facescan
```

### 2. Configurar a chave de API

Abra o arquivo `config/config.js` e preencha com sua chave:

```js
const ENV = {
  OPENROUTER_API_KEY: "sua-chave-openrouter-aqui",
  OPENROUTER_MODEL:   "nome/do-modelo",
};
Object.freeze(ENV);
```

> ⚠️ **Nunca commite sua chave real.** Adicione `config/config.js` ao `.gitignore` ou versione apenas um `config.example.js` com valores placeholder.

### 3. Escolher o modelo

O campo `OPENROUTER_MODEL` aceita qualquer modelo com suporte a visão disponível no OpenRouter:

| Modelo | Tipo | Características |
|---|---|---|
| `nvidia/nemotron-nano-12b-v2-vl:free` | Gratuito | Visão, bom custo-benefício |
| `google/gemini-2.0-flash-exp:free` | Gratuito | Rápido, multimodal Google |
| `openai/gpt-4o` | Pago | Alta precisão, referência de mercado |
| `anthropic/claude-3-5-sonnet` | Pago | Raciocínio avançado, ótima análise |
| `meta-llama/llama-3.2-90b-vision-instruct` | Pago | Open source de alta performance |

Modelos com sufixo `:free` funcionam sem créditos, mas podem ter limites de taxa de requisição.

### 4. Iniciar servidor local

Escolha qualquer uma das opções abaixo:

```bash
# Python (sem instalação extra)
python3 -m http.server 8080

# Node.js com npx
npx serve .

# Node.js com http-server
npx http-server -p 8080
```

Alternativamente, use a extensão **Live Server** do VS Code.

### 5. Acessar no browser

```
http://localhost:8080
```

Abra **preferencialmente no Google Chrome** para ter a detecção facial nativa em tempo real.

---

## Como Usar

### Tela de Configuração

Ao abrir a página, o sistema verifica automaticamente o arquivo `config/config.js`:

| Indicador | Significado |
|---|---|
| 🟢 Verde | Chave detectada e com formato válido — pronto para iniciar |
| 🟡 Amarelo | Chave não configurada ou ainda com valor placeholder |
| 🔴 Vermelho | Arquivo `config.js` não encontrado ou `ENV` indefinido |

Clique em **◈ INICIAR SISTEMA** para executar a sequência de inicialização:
1. Validação da chave contra a API do OpenRouter (requisição de teste)
2. Solicitação de permissão de câmera ao browser
3. Inicialização do sistema de detecção facial

### Tela Principal

- O feed da câmera é exibido espelhado horizontalmente (comportamento de espelho)
- Bounding boxes com pulsação aparecem automaticamente ao detectar rostos
- O botão **ESCANEAR** só fica ativo quando ao menos 1 rosto é detectado
- O painel lateral exibe estatísticas de detecções, análises e status
- Use **⟳ RESET** para zerar contadores e limpar a imagem capturada

### Realizando uma Análise

1. Posicione o rosto enquadrado no visor
2. Aguarde o bounding box aparecer com o label "ID-001"
3. Clique em **⊕ ESCANEAR E IDENTIFICAR**
4. Acompanhe as 5 etapas no overlay de loading
5. O popup de resultado abre automaticamente ao concluir
6. Pressione `Esc` ou clique fora do popup para fechar

---

## Detalhes Técnicos

### `config/config.js`

Arquivo de configuração simples que expõe o objeto global `ENV`, congelado com `Object.freeze()` para prevenir modificações acidentais em runtime. Contém apenas a chave de API e o nome do modelo selecionado.

### `js/app.js` — Módulo Principal

Implementado como uma **IIFE** (Immediately Invoked Function Expression) que encapsula todo o estado e expõe apenas os métodos necessários para o HTML:

```js
const App = (() => {
  const state = { apiKey, model, videoStream, faceDetector, ... };
  // módulos internos...
  return { init, scanFace, resetSession, closePopup };
})();
```

**Módulos internos:**

| Função | Responsabilidade |
|---|---|
| `init()` | Orquestra inicialização: testa API → câmera → detecção |
| `startCamera()` | `getUserMedia` com resolução ideal 1280×720, câmera frontal |
| `initFaceDetection()` | Detecta suporte à FaceDetector API e escolhe modo de operação |
| `runDetectionLoop()` | Loop assíncrono `requestAnimationFrame` com detecção por frame |
| `runFallbackOverlay()` | Overlay de guia estático para browsers sem FaceDetector |
| `drawFaceBox()` | Renderiza bounding box animado, cantos, crosshair e label no canvas |
| `scanFace()` | Captura frame corrigido + chama análise + exibe loading + popup |
| `analyzeWithGemini()` | Monta e executa requisição para o OpenRouter com progresso de etapas |
| `renderPopup()` | Popula todos os elementos do popup com os dados retornados pela IA |
| `renderErrorPopup()` | Exibe popup de erro com mensagem descritiva |
| `log()` | Adiciona linha timestampada ao painel de log (máximo de 50 linhas) |
| `testApiKey()` | Validação rápida da chave com requisição mínima de 5 tokens |

### Captura de Frame com Espelhamento Corrigido

O vídeo é exibido com `transform: scaleX(-1)` para parecer um espelho. Na captura, o canvas aplica a mesma transformação antes de desenhar, garantindo que a imagem enviada para a IA corresponde à realidade (não espelhada):

```js
ctx.save();
ctx.scale(-1, 1);
ctx.drawImage(video, -capture.width, 0);
ctx.restore();
```

### Requisição para o OpenRouter

```
POST https://openrouter.ai/api/v1/chat/completions
```

Headers enviados:
- `Authorization: Bearer <chave>` — autenticação
- `HTTP-Referer: <url-da-página>` — boa prática exigida pelo OpenRouter
- `X-Title: FaceScan` — identifica a aplicação nos logs do OpenRouter

O corpo segue o formato OpenAI Chat Completions com content multimodal (array de blocos `text` + `image_url`). A imagem é enviada como `data:image/jpeg;base64,...`.

### Parsing Robusto da Resposta

A resposta da IA é extraída com regex para capturar o JSON mesmo quando o modelo adiciona texto ou markdown:

```js
const match = text.match(/\{[\s\S]*\}/);
const parsed = JSON.parse(match[0]);
```

---

## Interface e Componentes de UI

### Design System — Paleta de Cores

| Token CSS | Valor | Uso |
|---|---|---|
| `--violet` | `#8b5cf6` | Cor primária, bordas, glow |
| `--lavender` | `#a78bfa` | Texto de destaque |
| `--lilac` | `#c4b5fd` | Labels e títulos de seção |
| `--orchid` | `#e879f9` | Accent gradiente, scan line |
| `--success` | `#86efac` | Status OK, tags positivas, câmera online |
| `--warn` | `#fcd34d` | Avisos, badge de rostos |
| `--danger` | `#f87171` | Erros, botão fechar |

### Tipografia

| Fonte | Peso | Aplicação |
|---|---|---|
| Syne | 800 | Títulos, botões, nomes, logo |
| DM Sans | 300–600 | Corpo de texto, sumários |
| JetBrains Mono | 300–500 | Labels técnicos, log, badges, código |

### Animações CSS

| Nome | Efeito |
|---|---|
| `pulse-soft` | Pulsação suave do ícone do logo |
| `blink-dot` | Piscar dos indicadores de status |
| `scanMove` | Linha de scan percorrendo verticalmente o visor |
| `spin` | Spinner duplo concêntrico no loading overlay |
| `fadeUp` | Entrada do card de setup (translateY + opacity) |
| `slideIn` | Entrada do popup de resultado (scale + translateY) |
| `shimmer` | Brilho pulsante na barra de progresso |

---

## Resposta da IA — Estrutura JSON

O modelo é instruído via prompt a retornar **exclusivamente** JSON válido com esta estrutura:

```json
{
  "web_info": {
    "identified": true,
    "confidence": "Alta | Média | Baixa",
    "confidence_pct": 85,
    "name": "Nome Completo ou Desconhecido",
    "occupation": "Profissão ou traço",
    "nationality": "Nacionalidade ou traço",
    "born": "Data de nascimento ou estimativa",
    "known_for": "Motivo de notoriedade",
    "summary": "Breve biografia ou nota de não identificação",
    "tags": ["tag1", "tag2", "tag3"]
  },
  "status": {
    "humor": "Calmo | Animado | Neutro | Cansado | Estressado",
    "expressao": "Descrição da expressão facial",
    "caracteristicas": "Traços físicos visíveis — cabelo, olhos, pele, idade estimada",
    "ambiente": "Quarto | Escritório | Área externa | Fundo neutro",
    "iluminacao": "Natural | Artificial | Baixa | Boa iluminação",
    "postura": "Centralizado | De lado | Inclinado",
    "tags": ["tag1", "tag2", "tag3"]
  }
}
```

O campo `confidence_pct` é gerado pelo modelo (0–100). Caso ausente, o frontend aplica fallback: Alta → 88%, Média → 60%, Baixa → 35%.

---

## Compatibilidade

| Browser | Detecção Facial Nativa | Análise IA | Observação |
|---|---|---|---|
| Google Chrome 87+ | ✅ | ✅ | Recomendado |
| Microsoft Edge (Chromium) | ✅ | ✅ | |
| Firefox | ⚠️ Fallback | ✅ | FaceDetector não suportado |
| Safari | ⚠️ Fallback | ✅ | FaceDetector não suportado |
| Chrome Android | ✅ | ✅ | |
| Safari iOS | ⚠️ Fallback | ✅ | |

No modo **fallback**, o sistema exibe um overlay de guia de posicionamento e o botão de scan fica habilitado para uso manual, sem a contagem automática de rostos por frame.

---

## Limitações e Considerações Éticas

- **Precisão de identificação:** o modelo tenta identificar pessoas com base em dados de treinamento públicos. A precisão é limitada e variável — pessoas muito famosas podem ser identificadas, pessoas comuns serão classificadas como "Desconhecido". Os resultados não são confiáveis para fins críticos.
- **Privacidade:** a imagem capturada é transmitida para os servidores do OpenRouter e do modelo selecionado. Não utilize com imagens de pessoas que não consentiram explicitamente.
- **Dados não armazenados:** o FaceScan em si não armazena nenhum dado — não há banco de dados, sessão persistente, telemetria ou cookies de rastreamento.
- **Uso responsável:** este projeto é de caráter **educacional e experimental**. Não deve ser utilizado para vigilância, monitoramento não-consentido, ou qualquer finalidade que viole leis de privacidade vigentes (LGPD, GDPR, etc.).

---

## Roadmap

- [ ] Análise individual por crop para múltiplos rostos simultâneos
- [ ] Histórico local de scans com localStorage
- [ ] Exportar perfil como PDF ou imagem
- [ ] Seletor de modelo na própria interface (sem editar `config.js`)
- [ ] Suporte a upload de foto estática além da câmera
- [ ] PWA com manifest para instalação como app
- [ ] Internacionalização (EN / ES)

---

<div align="center">

Feito com JavaScript puro, Canvas API e OpenRouter.

</div>