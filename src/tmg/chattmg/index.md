---
title: ChatTMG
---

<script setup>
 import Image from '@/Components/Image.vue'

 import interfaceHomeImg from './img/interface/home.png'

 import dataAbout1Img from './img/training-data/about-1.png'
 import dataAbout2Img from './img/training-data/about-2.png'
 import dataClientsImg from './img/training-data/clients.png'
 import dataOfficialImg from './img/training-data/official.png'

</script>

# ChatTMG: Building a custom chatbot with Laravel and Vue

This is a technical walkthrough of building an on-brand LLM-based chatbot that answers common questions about a [tensiomyography (TMG)](https://en.wikipedia.org/wiki/Tensiomyography), a specialized biomechanical diagnostic tool for measuring muscle contraction speed, using the [Laravel](https://laravel.com/) + [Vue](https://vuejs.org/) + [Inertia.js](https://inertiajs.com/) stack.

**You can view the chatbot [live on TMG's website](https://chat.tmg-bodyevolution.com/chat)**; the interface looks something like this:

<Image :src="interfaceHomeImg" caption="The chatbot's interface, modelled after the familiar ChatGPT interface visitors are used to, but with custom branding." />

The article is meant as a technical guide for a specific audience: other people interested in building a custom chatbot who are familiar with the general Laravel/Vue/Inertia stack, but unfamiliar with setting up the infrastructure for a chatbot.
Throughout the write-up, I assume you're familiar with general Laravel/Vue/Inertia concepts (or willing to learn as you go); the write-up focuses on the chatbot-specific parts.

## Technical overview

- Backend: Laravel
- Frontend: Vue
- LLM: OpenAI's Responses API, using RAG with a vector store of  TMG-related documents and copy.

The Vue frontend has a familiar ChatGPT-like interface with TMG branding, and sends users' prompts to a Laravel backend. The backend forwards prompts to the OpenAI Responses API and returns streamed responses to the frontend using the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).

## The chatbot's goal

The chatbot's audience is prospective buyers of the TMG S1 and S2 measurements systems made by TMG-BMC Ltd. in Slovenia; the chatbot answers questions about tensiomyography's usage, applications, and comparison to other diagnostic tools, with links to instructional videos, references to scientific publications validating tensiomyography (TMG), etc.
The chatbot is essentially a customer conversion tool meant to facilitate the initial "contact us for more information" phase.

## LLM provider

This project used [OpenAI's Responses API](https://platform.openai.com/docs/api-reference/responses) with file search to power the chatbot.

At the time of writing, this was the de-facto tool for building chatbots with an external LLM provider, and we decided using OpenAI's API with built-in file search was most efficient and cost-effective for our relatively straightforward use case.

There are of course other LLM providers, and one could even self-host a custom RAG and LLM pipeline, but that falls beyond the scope of this article, and probably also beyond the needs of a typical reader of this guide.

## Preparing a knowledge base

Because tensiomyography is a niche topic, a custom chatbot requires a knowledge base of domain-specific information not found in the generic training data of an all-purpose LLM.

In this project, the chatbot's knowledge base comes from a few hundred pages of combined user manuals, guides, introductory explanations of tensiomyography, information about TMG-BMC Ltd. the company, academic journal articles, reviews of TMG, press, and marketing materials. The material (after processing) looks something like this:

<div class="grid grid-cols-2 gap-4">
  <div class="text-center">
    <Image :src="dataAbout2Img" />
  </div>

  <div class="text-center grid place-items-center">
    <Image :src="dataAbout1Img" />
  </div>

  <div class="col-span-2">
    <Image :src="dataOfficialImg" />
  </div>
</div>

Where possible, material was **consolidated into plain-text Markdown files** from the original combination of Word, PDF, and web content using a combination of `pandoc`, `pdfminer`, and manual intervention.

This material is then ready for chunking and embedding, for later use with RAG.

::: details Plain text is not crucial {open}
I consolidated materials into Markdown in this project, but doing so is not crucial—OpenAI can ingest Word, PDF, and many other files when preparing a vector store.

But consolidated, hand-curated plain text (when feasible) certainly gives you more control over what information OpenAI will ingest (and thus better answers), generally cuts down on file size (and thus hosting costs) and also makes it easier to perform manual chunking should we choose to migrate to a custom embedding pipeline in the future.
:::


## Embedding and RAG

This project used OpenAI's out-of-the-box [vector store](https://platform.openai.com/docs/api-reference/vector-stores) and [file](https://platform.openai.com/docs/api-reference/files) features to handle embedding and RAG.
This was most efficient and cost-effective for this relatively simple case, where the knowledge base consisted of hundreds of pages from some 30-40 documents.
In a large corporation you might find hundreds of thousands of pages across tens of thousands of documents, in which case you'll probably use an in-house chunking, embedding, and RAG pipeline for more control.

Using OpenAI's built-in RAG features, the process looks like this:

1. Create a vector store with the [Vector Store API](https://platform.openai.com/docs/api-reference/vector-stores), or via the [GUI interface on OpenAI's website](https://platform.openai.com/storage/vector_stores).
   You end up with a vector store id, which looks something like `vs_123456789123456789123456`.
   You later use this vector store id to connect your chatbot to your vector store.

1. Upload the files in the knowledge base to OpenAI with the [Files API](https://platform.openai.com/docs/api-reference/files) or via the [GUI interface on OpenAI's website](https://platform.openai.com/storage/files).
   You end up with a file ids like `file-1234567891234567891234`.

1. Attach uploaded files to the vector store, again using either the [API](https://platform.openai.com/docs/api-reference/vector-stores-files) or [GUI](https://platform.openai.com/storage/vector_stores).

OpenAI takes care of the RAG pipeline for you from there: OpenAI creates embeddings when you create the vector store, and performs RAG at query time when you use the File Search tool with your vector store in your Responses API calls.

::: info Overview of RAG
At the time of writing, *retrieval aided generation* (RAG) is the de facto way for a chatbot to retrieve information from a custom knowledge base.
In principle RAG can be used with multimodal data; I'll focus here only on text-based RAG (where your knowledge base consists of text), since this is the typical use case at the time of writing.

A standard *text-based* RAG pipeline has the following steps:

1. **Assemble a knowledge base** of text files (Markdown, plain text, Word, PDF, etc.); if needed, extract relevant plain text from binary and container formats like Word and PDF (this is often done for you under the hood by services like OpenAI).
1. **Chunk the knowledge base**: split the files in the knowledge base into *chunks* of plain text.
   A typical chunk size is roughly 500-1000 LLM tokens at the time of writing; in turn, a typical LLM token is roughly 3-4 English characters.
1. **Create embeddings from each chunk**: convert each chunk of text into long sequences of floating point numbers (vectors in R^N) with an embedding model (e.g. OpenAI's `text-embedding-3-large`)
1. **Store embeddings in a vector database** like Pinecone, pgvector, FAISS, etc.
1. **At query time**, create an embedding from the user’s query and search the vector database for embeddings similar to the user's query; retrieve the most relevant chunks.
1. **Generate a response:** add retrieved chunks from the vector database into the LLM as context, along with the user’s query.
   The LLM processes the retrieved chunks and creates an answer.
:::

## Backend setup

I'll start with chatbot's backend setup.

I used and recommend the [OpenAI PHP Laravel package](https://github.com/openai-php/laravel) for interacting with the OpenAI API.
(The package provides a convenient Laravel-style wrapper around [OpenAI PHP package](https://github.com/openai-php/client), which in turn provides a PHP interface for interacting with the OpenAI API.)

Install it as follows:

```bash
# Install and set up openai-php/laravel
composer require openai-php/laravel
php artisan openai:install
```

### .env file

Add your OpenAI API key, organization id, and vector store id to you `.env` file:

```bash
# .env
# These are made-up values, obviously
OPENAI_API_KEY="sk-012345678919012345678901234567890123456789012345"
OPENAI_ORGANIZATION="org-123456789123456789123456"
OPENAI_VECTOR_STORE_ID="vs_123456789123456789123456"
```

Comments:

- The example `.env` variables are made-up, obviously—*never share API keys or you organization ID publicly and always exclude your `.env` file from Git repos*.
- The `openai-php/laravel` package automatically picks up your API key and organization ID from `OPENAI_API_KEY` and `OPENAI_ORGANIZATION` and uses them to authenticate with OpenAI's APIs.
- We will use the vector store ID to attach the vector store to response generation.

### OpenAI-related config values

Running `php artisan openai:install` (when you installed `openai-php/laravel`) creates a config file at `config/openai.php` for OpenAI-related information.
Open this config file and add a few more custom values to register your desired model, chatbot instructions, and vector store id:

```php
<?php
// config/openai.php
'app' => [
  'model' => 'gpt-4o-mini',
  'vector_store_id' => env('OPENAI_VECTOR_STORE_ID'),
  'instructions' => "Use your custom knowledge base to help visitors to TMG's website (coaches, sports professionals, etc.) learn what tensiomyography is and how it could be useful to them.",

  // You can also use a heredoc for longer instructions
  'instructions_long' => <<<'EOT'
  Help visitors to TMG-BMC Ltd.'s website...
  Make sure to:
  - Lorem ipsum dolor...
  - sit amet...
  - consectetur adipiscing elit...
  EOT,
],
```

Obviously the models will change (and improve) with time; we used `gpt-4o-mini` at the time of writing with good results.
You should be above to find an up-to-date list with pricing information [in the OpenAI pricing docs](https://platform.openai.com/docs/pricing).

## Design choice: chats scoped to one page lifecycle

By design, in this project I have scoped chats to one client-side page lifecycle.
Conversations are restarted on a page refresh, similar to ChatGPT's web interface if you are not logged in.
Chats *are not* stored server-side in a database or other long-term storage.

Chat history within a given session is maintained in browser memory over the course of the conversation in a reactive Vue variable, and in server memory using [Laravel's cache](https://laravel.com/docs/cache).
The app maintains conversation history over the course of a given chat to provide context for generating new responses based on the conversation so far; both the backend and frontend keep a copy of the conversation to avoid having to send the full conversation history back and forth over the network.

This design works well because the chatbot is meant for one-off queries.
Avoiding long-term server-side storage simplifies backend complexity (persisted conversations would require user accounts and dedicated database tables) and avoids the regulatory complications that come with storing user information serverside in the EU.

## JSON format for representing conversation

We represent conversations as an array of Javascript objects with `role` and `content` keys; `role` indicates who is speaking (chatbot or user) and `content` stores the message's text content.

This conversation format matches OpenAI's conversation format, and is intentionally chosen to allow direct plug-and-play with OpenAI's Responses API.

Here is an example [from the OpenAI docs](https://platform.openai.com/docs/guides/conversation-state?api-mode=responses#manually-manage-conversation-state):

```javascript
// Example conversation
let conversation = [
  { role: "user", content: "knock knock." },
  { role: "assistant", content: "Who's there?" },
  { role: "user", content: "Orange." },
]

/*
  Equivalent text:
  ----------------
  User: knock knock.
  Assistant: Who's there?
  User: Orange.
*/
```


The backend would store the conversation in a PHP array in a cache entry that looks something like this:

```php
<?php
[
  // Backend stores conversations in the Laravel cache, keyed by
  // conversation ID (discussed below)
  "d933cabd-6af7-4f62-b04c-11c5f8e0b523" => [
    [
      "role" => "user",
      "content" => "knock knock."
    ],
    [
      "role" => "assistant",
      "content" => "Who's there?"
    ],
    [
      "role" => "user",
      "content" => "Orange."
    ],
  ],
]
```

## Session registration and conversation IDs

Recall that both the backend and frontend store conversation in short-term memory.

The backend needs the full conversation history to provide context for future answers based on the conversation so far;
keeping the conversation in serverside memory avoids having the frontend send the full conversation history over the network with every new prompt (and the associated parsing and validation involved).

A given conversation is kept in sync between backend and frontend using a unique **conversation ID**.
The backend stores conversation history using a cache entry keyed by conversation ID, the frontend sends the conversation id with every prompt, and the backend uses the conversation id to match the prompt to an existing conversation.

A UUID looks something like this: `"d933cabd-6af7-4f62-b04c-11c5f8e0b523"`

To manage session registration, we first create **a POST route** that the frontend uses to create a new conversation.

```php
<?php
// routes/web.php
// Route used to register new conversations
Route::post('/chat/register', [OpenAiController::class, 'register'])->name('chat.register');
```

The corresponding **controller method** is:

```php
<?php
// app/Http/Controllers/OpenAiController.php
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Http\Request;

class OpenAiController extends Controller
{
  
  /**
   *  Create a new UID.
   *  Create a new cache entry with an empty conversation, keyed by
   *  conversation id, to store the conversation in short-term serverside
   *  memory.
   *  Return conversation id to frontend as a JSON response.
   */
  public function register(Request $request) {
    $conversationId = (string) Str::uuid();
    Cache::put("conversation:{$conversationId}", [], now()->addMinutes(30));
    return response()->json(['conversationId' => $conversationId]);
  }
}
```

**On the frontend**, a `registerConversation` function handles sending requests for new conversation ids, and the Vue component with the chatbot interface calls the `registerConversation` when mounted.
The backend processes the request, registers a new conversation, and returns the conversation id to the frontend.
In practice the entire registration process completes within the first few hundred milliseconds of the user's visit and is seamless/transparent to the user.

The **relevant frontend code** looks something like this:

```vue
<!-- In the Vue component with the Chatbot interface, e.g. resources/js/Pages/ChatbotInterface.vue -->
<script setup>
import { ref, onMounted, } from 'vue'

const conversationId = ref(null)
function registerConversation() {
  axios.post(route('chat.register'))
    .then(response => {
      conversationId.value = response.data.conversationId;
    })
    .catch(error => {
      setErrorMessage("There was an error setting up your conversation.")
    });
}

// Register a new conversation when mounted
onMounted(() => {
  registerConversation()
})
</script>
```

## Sending prompts from frontend to backend

The frontend sends conversation prompts to the backend in the following format:

```javascript
{
  prompt: "What is TMG and what is it used for?",
  conversation_id: "d933cabd-6af7-4f62-b04c-11c5f8e0b523",
}
```

The `prompt` key stores the user's most recent prompt; `conversation_id` identifies the conversation to the backend and lets the backend look up conversation history to provide context for its answer.

I'll describe the mechanism of sending the request using the Fetch API below (**TODO:** link); for now I'm just showing the format in the context of discussing validation.

## Validating prompts

The backend validates form data send from the frontend using a custom [Form Request](https://laravel.com/docs/validation#form-request-validation) called ChatRequest:

```bash
php artisan make:request ChatRequest
```

The ChatRequest sees input data like this...

```php
<?php
[
  "prompt" => "What is TMG and what is it used for?",
  "conversation_id" => "d933cabd-6af7-4f62-b04c-11c5f8e0b523",
]
```

...which it validates with the following rules:

```php
<?php

// app/Http/Requests/ChatRequest.php
class ChatRequest extends FormRequest
{
  public function rules(): array
  {
    return [
      // Allow up to 5000 (for example; could be adjusted) characters in a prompt
      'prompt' => ['required', 'string', 'min:1', 'max:5000'],

      // Laravel's uuid rule conveniently handles conversation ids
      'conversation_id' => ['required', 'uuid'],
    ];
  }

  // I use custom validation messages, which are a bit clearer than Laravel's default messages
  public function messages(): array
  {
    return [
      'conversation_id.required' => 'A conversation ID is missing.',
      'conversation_id.uuid' => 'The conversation ID is invalid.',
      'prompt.required' => 'The prompt is missing.',
      'prompt.string' => 'The prompt must be a string.',
      'prompt.max' => 'The prompt can be at most 5000 characters.',
    ];
  }

}
```

## Routes

I use three routes for the

- `/chat`: a GET route that returns an Inertia-rendered Vue page `resources/js/Pages/Chat.vue` with the chatbot interface:

  ```php
  <?php
  use Inertia\Inertia;
  use Illuminate\Support\Facades\Route;

  Route::get('/chat', function () {
    return Inertia::render('Chat');
  })->name('chat.interface');
  ```

- `/chat/stream`: a POST route handled by a controller method that returns a streamed chatbot response using the Fetch API:

  ```php
  <?php
  use App\Http\Controllers\OpenAiController;
  use Illuminate\Support\Facades\Route;

  Route::post('/chat/stream', [OpenAiController::class, 'stream'])->name('chat.stream');
  ```

- `/chat/register`: the POST route discussed above **TODO:** link in the context of session registration.

## Calling the OpenAI Responses API

Here is proof-of-concept code for calling the OpenAI Responses API to generate a response from a given prompt, based on the conversation history so far and using a vector store for file search/RAG:

```php
<?php
use OpenAI\Laravel\Facades\OpenAI;

# Choose a model
$model = "gpt-4o-mini";

# Conversation history so far, to provide context for new responses
$conversation = [
  [ 'role': "user", 'content': "knock knock." ],
  [ 'role': "assistant", 'content': "Who's there?" ],
  [ 'role': "user", 'content': "Orange." ],
];

# Instructions passed to LLM
$instructions = "You are a friendly chatbot who plays along with users' jokes.";

# ID of vector store to use for RAG
$vectorStoreId = "vs_123456789123456789123456";

$response = $client->responses()->create([
  'model' => $model,
  'input' => $conversation,
  'instructions' => $instructions,
  'tools' => [[
    'type' => 'file_search',
    'vector_store_ids' => [$vectorStoreId],
  ]],
]);

echo $response->outputText;
```

The full output text is available at `$response->outputText`; for details see the [openai-php/client docs](https://github.com/openai-php/client?tab=readme-ov-file#responses-resource).


::: warning
The call to `$client->responses()->create()` blocks until OpenAI generates the entire response—a chatbot end user would have to wait until the full response is generated before any text appears.

Streamed responses (described below) solve this problem and provide a better experience in a production chatbot.
:::

### Streamed responses

This project uses streamed responses so that the chatbot's answers appear on screen as they are being generated.

Below is proof of concept code for calling the OpenAI Responses API to generate a *streamed* response (using the same parameters as above for non-streamed responses).
You first create a stream using `createStreamed()`, then consume the stream event by event, handling each event based on its type.

```php
<?php
// Create a streamed response
$stream = OpenAI::responses()->createStreamed([
  'model' => $model,
  'input' => $conversation,
  'instructions' => $instructions,
  'tools' => [[
    'type' => 'file_search',
    'vector_store_ids' => [$vectorStoreId],
  ]],
]);

// You can then immediately begin consuming the stream.
foreach ($stream as $event) {
  if ($event->event === 'response.output_text.delta') {  // new text received
    $chunk = $event->response->delta;
    echo $chunk;
  } else if ($event->event === 'error') {  // error
    echo 'Oh no, a streaming error!';
    return;
  } else if ($event->event === 'response.completed') {  // response complete
    echo 'Response complete!';
    return;
  }
}
```

In practice, at least for simple use cases, you'll be most interested in the `response.output_text.delta` event; this event contains new chunks of output text sent by OpenAI; you string together these text deltas to create the full chatbot response.

Off course, there are *many* more events than I've shown in the simple proof-of-concept snippet above.
See the [OpenAI docs](https://platform.openai.com/docs/api-reference/responses-streaming) for a full list of events and their payloads.

## Sending streamed response from controller to frontend

In the production app, the controller sends the streamed response to the frontend using the Fetch API, and sends data in JSON objects with a `type` key to specify a message type and a `content` key with the message payload.

A typical message the backend would send to the frontend looks like this:

```javascript
// New response data from a response.output_text.delta event
{ type: "data", content: "TMG is a non-invasive tech" }

// An error message
{ type: "error", content: "Streaming error" }
```

Controller code for consuming OpenAI's streamed response and then forwarding the response to the frontend looks like this:

```php
<?php
$stream = OpenAI::responses()->createStreamed([/* ... */]);

foreach ($stream as $event) {
  // Handle each event, create a corresponding JSON message, forward message to frontend
  if ($event->event === 'response.output_text.delta') {  // new text received
    $chunk = $event->response->delta;
    echo json_encode(['type' => 'data', 'content' => $chunk]) . "\n";
    ob_flush();
    flush();
  } else if ($event->event === 'error') {  // error
    echo json_encode(['type' => 'error', 'content' => 'Streaming error']) . "\n";
    ob_flush();
    flush();
    return;
  } else if ($event->event === 'response.completed') {  // response complete
    return;
  }
}
```

The `echo`, `ob_flush()`, and `flush()` calls are a standard PHP pattern for sending a streamed response from a PHP backend to the browser (see e.g. [this snippet in the Laravel docs](https://laravel.com/docs/11.x/responses#streamed-responses)); the frontend can then consume this response piece by piece using the Fetch API.

Note that each message is stringified in the backend using `json_encode` and that messages are delimited by new line characters (this is a standard pattern for sending structured JSON data one record at a time; see [JSON Lines](https://jsonlines.org/));
the frontend can then extract messages by splitting the streamed response on new line characters and use `JSON.parse()`.

(The newline-based delimiting works because any newline characters in actual message payloads will be escaped to `\\n` by `json_encode`, so `\n` is guaranteed to uniquely delimit messages.)

## Edge case: handling expired conversations

Conversations are cached serverside in short-term memory; what happens when the cache entry expires?

A concrete scenario: a user starts a conversation, leaves the browser tab with the conversation open, and returns after a few hours.
The browser will still have the conversation in memory, but the backend cache entry holding the conversation on the server will have expired; the browser should start a new chat and resync with the backend.

Two notes:

- A similar workflow happens with ChatGPT's "temporary chat" feature, where (at the time of writing) chats expire after 24 hours.
- This is unlikely to happen in practice since the chatbot is usually used for one-off queries and closed; rarely would anyone start a conversation and come back to it later.

In this case it is good UX to at least inform the user what is going on—their chat has expired and a new one will begin.
Here is supporting backend code:

```php
<?php

class OpenAiController extends Controller
{
  public function stream(ChatRequest $request)
  {
    // Extract user's prompt and conversation ID from validated request
    $validated = $request->validated();
    $conversationId = $validated['conversation_id'];
    $prompt = $validated['prompt'];

    // Load conversation history from cache
    $conversation = Cache::get("conversation:{$conversationId}");

    // Handle expired (null) conversations
    if (is_null($conversation)) {
      return new StreamedResponse(function () {
        echo json_encode([
          'type' => 'error',
          'message' => 'Session expired. Starting new chat.',
        ]) . "\n";
        ob_flush();
        flush();
      }, 200, [
          'Content-Type' => 'text/plain; charset=utf-8',
          'Cache-Control' => 'no-cache',
          'X-Accel-Buffering' => 'no',
        ]);
    }
  }
}
```

## Controller

Putting together the pieces so far (cache entries; session registration; validating prompts; Calling the OpenAI Responses API; Sending streamed response from controller to frontend; handling expired chats) gives the main controller stream function that handles requests for chatbot responses:

**TODO:** links to subheadings

```php
<?php

use App\Http\Requests\ChatRequest;
use Illuminate\Support\Facades\Cache;
use OpenAI\Laravel\Facades\OpenAI;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OpenAiController extends Controller
{
  public function stream(ChatRequest $request)
  {
    // Extract user's prompt and conversation ID from validated request
    $validated = $request->validated();
    $conversationId = $validated['conversation_id'];
    $prompt = $validated['prompt'];

    // Load conversation history from cache
    $conversation = Cache::get("conversation:{$conversationId}");

    // Handle expired (null) conversations
    if (is_null($conversation)) {
      return new StreamedResponse(function () {
        echo json_encode([
          'type' => 'error',
          'message' => 'Session expired. Starting new chat.',
        ]) . "\n";
        ob_flush();
        flush();
      }, 200, [
          'Content-Type' => 'text/plain; charset=utf-8',
          'Cache-Control' => 'no-cache',
          'X-Accel-Buffering' => 'no',
        ]);
    }

    // Add user's new prompt to conversation history
    $conversation[] = ['role' => 'user', 'content' => $prompt];

    return new StreamedResponse(function () use ($conversationId, $conversation) {
      try {
        // Create a streamed response
        $stream = OpenAI::responses()->createStreamed([
          'model' => config('openai.app.model'),
          'input' => $conversation,
          'store' => false,
          'instructions' => config('openai.app.instructions'),
          'tools' => [[
            'type' => 'file_search',
            'vector_store_ids' => [config('openai.app.vector_store_id')],
          ]],
        ]);

        // For building up assistant's complete response
        $completeResponse = '';

        foreach ($stream as $event) {
          if ($event->event === 'response.output_text.delta') {
            $chunk = $event->response->delta;
            echo json_encode(['type' => 'data', 'content' => $chunk]) . "\n";
            ob_flush();
            flush();
            $completeResponse .= $chunk;
          } else if ($event->event === 'error') {
            echo json_encode(['type' => 'error', 'content' => 'Streaming error']) . "\n";
            ob_flush();
            flush();
            return;
          } else if ($event->event === 'response.completed') {
            // Updated cached conversation history with assistant's response
            $conversation[] = ['role' => 'assistant', 'content' => $completeResponse];
            Cache::put("conversation:{$conversationId}", $conversation, now()->addMinutes(30));
            return;
          }
        }
      } catch (\Throwable $e) {
        // Handle error (e.g. log serverside, notify frontend, etc.)
      }
    }, 200, [
        'Content-Type' => 'text/plain; charset=utf-8',
        'Cache-Control' => 'no-cache',
        'X-Accel-Buffering' => 'no',
      ]);
  }
}
```

## Sending requests: CSRF token

The frontend sends requests for chatbot responses to the backend's `chat.stream` route using the Fetch API.
Actual production code looks like this:

```javascript
import { ref } from 'vue'

// `usePage` and `page` are used to access CSRF
import { usePage } from '@inertiajs/vue3'
const page = usePage()

// Conversation ID is set during session registration
const conversationId = ref(null)

// The user's prompt
const prompt = ref("")

const response = await fetch(route('chat.stream'), {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",  // needed to receive validation errors as JSON
    "X-CSRF-TOKEN": page.props.auth.csrf,
  },
  body: JSON.stringify({
    conversation_id: conversationId.value,
    prompt: prompt.value,
  }),
});
```

Notes:

- CSRF validation must be handled manually (discussed below)
- `"Accept": "application/json"` is needed to receive validation errors (discussed below)
- The request body contains `conversation_id` and `prompt` fields, which are picked up and validated by the ChatRequest form request **TODO:** link above

### CSRF

The `X-CSRF-TOKEN` header must be passed manually to satisfy Laravel's built-in CSRF validation. **TODO:** preciseness of phrasing
(Inertia and Axios, which are commonly used with the Laravel + Vue stack, usually pass a CSRF token under the hood, but we must do this manually when sending requests with the comparatively low-level Fetch API.)

To make the CSRF token available in the frontend, I include it Inertia's `page.props.auth` object, which is shared with all frontned pages.
I do this in `app/Http/Middleware/HandleInertiaRequests.php`; Laravel's `csrf_token()` helper is globally available.

**TODO:** link to Inertia docs.

```php
<?php
// app/Http/Middleware/HandleInertiaRequests.php
public function share(Request $request): array
{
    return [
        ...parent::share($request),
        'auth' => [
            'user' => $request->user(),
            'csrf' => csrf_token(),
        ],
    ];
}
```

### Validation

**TLDR:** passing the `"Accept": "application/json"` ensures Laravel returns validation errors as JSON with a 422 response code, which our frontend can then handle.

In more detail: Laravel has two ways of returning validation errors when using Form Request validation.
By default, Laravel's `FormRequest` assumes a *web form* submission, and when validation fails, Laravel issues a 302 redirect back to the previous page, flashes errors to the session, and expects the browser to render them via Blade or Inertia.

Meanwhile, if a request declares `"Accept": "application/json"`, then Laravel returns validation errors in a 422 JSON response like:

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "conversation_id": ["The conversation id must be an integer."]
  }
}
```

Our frontend specifies `"Accept": "application/json"` with the `fetch` request, since handling JSON responses is more ergonomic than handling flashed data when using the fetch API.

Actual code for catching and handling validation errors might look something like this:

```javascript
const response = await fetch(route('chat.stream'), {/* ... */});

if (!response.ok) {
  // Validation errors are returned with a 422 status code
  if (response.status === 422) {
    const errorData = await response.json();
    validationErrors.value = errorData.errors;
    return;
  } else throw new Error("Error generating response");
}

if (!response.body) {
  throw new Error("Error generating response");
}
```

## Consuming stream in frontend

In the Vue frontend, the mechanics of consuming the backend's response look something like this:

```javascript
// Fetch a new streamed chatbot response
const response = await fetch(route('chat.stream'), {/* ... */});

/* ... check response for errors ... */

// Assuming response is OK...

// Reader reads response at byte level...
const reader = response.body.getReader();

// ...and decoder converts the bytes to text
const decoder = new TextDecoder("utf-8");

// Streamed responses are temporarily buffered...
let buffer = "";

// Process streamed response chunk by chunk
while (true) {
  const { value, done } = await reader.read();
  if (done) break;  // `reader` detects end of response TODO with EOF

  // Append decoded text to buffer and extract newline-delimited messages
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");

  // Save any incomplete trailing data in the start of the next buffer
  buffer = lines.pop();  // explained below  // [!code highlight]

  for (const line of lines) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);  // decode JSON-encoded message
    if (msg.type === "data") {
      console.log(msg.content);  // new streamed text here
    } else if (msg.type === "error") {
      // **TODO:** link to handling expired chats in backend
      if (msg.message?.includes("Session expired")) {  // handle expired chats
        setInfoMessage("Session expired. Starting a new chat.");
        newChat();
      } else {
        setErrorMessage("Error generating response.")
      }
    }
  }
}
```

The general structure follows a standard JS pattern for reading a streamed response fetched with the Fetch API; at the time of writing, you can see an example [on MDN's ReadableStream page](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream#fetch_stream).

A comment on the highlighted `buffer = lines.pop();` line, which is perhaps confusing:

- Response sent from backend to frontend is a stream of new-line delimited stringified JSON objects with a `type` and `data` key.
  **TODO:** link to section
  This stream is received in chunks by the frontend and accumulated in a buffer.
- `const lines = buffer.split("\n");` splits the buffer's contents into individual messages sent by backend
- In general, the buffer will not end at a clean message boundary (i.e. the final character in `buffer` will not be the message terminator `"\n"`) and the final entry in `lines` will be only the first part of a message
- `buffer = lines.pop();` resets the buffer and places the incomplete beginning of the final entry in lines at the start of the buffer for the next loop iteration, where it will be completed by the start of the next chunk received by the frontend.
  (The case where `buffer` *does* cleanly end at a message boundary, in which case the final entry in `lines` is an empty string, is handled by `if (!line.trim()) continue;`.)

## Displaying content

As the frontend consumes the backend's streamed response, it appends each streamed chunk's content to a reactive Vue variable `const conversation = ref([])` holding the conversation.

Vue updates the DOM as the `conversation` variable updates.

```javascript
import { ref, nextTick } from 'vue'

// Conversation contains objects of the form
// { role: 'user', 'content': "Here is my question..." }
// { role: 'assistant', 'content': 'Here is my response...' }
const conversation = ref([])

// Add user's prompt to conversation
conversation.value.push({ role: 'user', content: prompt.value, })

// Fetch streamed response from backend
const response = await fetch(route('chat.stream'), {/* ... */});

if (!response.ok) { /* handle errors */ }

// Prepare placeholder for chatbot's reply
conversation.value.push({ role: 'assistant', content: "" })

const reader = response.body.getReader();
const decoder = new TextDecoder("utf-8");
let buffer = "";

while (true) {
  const { value, done } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");

  // Saves any incomplete trailing data in the start of the next buffer
  buffer = lines.pop();

  for (const line of lines) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.type === "data") {
      // Append each new chunk of streamed response to chatbot's answer
      conversation.value[conversation.value.length - 1].content += msg.content;    // [!code highlight]
      await nextTick();
    } else if (msg.type === "error") {
      if (msg.message?.includes("Session expired")) {  // handle expired chats
        setInfoMessage("Session expired. Starting a new chat.");
        newChat();
      } else {
        setErrorMessage("Error generating response.")
      }
    }
  }
}
```

## Careful with Markdown responses

OpenAI's Responses API responds with Markdown (not plain text).
Markdown is good—it provides structure and formatting—but must be handled carefully.

An example response from OpenAI looks like this:

**TODO:** can you wrap the code block onto multiple lines?

```json
[
  {
    "role": "user",
    "content": "How can TMG help monitor injuries during return to play?"
  },
  {
    "role": "assistant",
    "content": "TMG (Tensiomyography) is a powerful tool that can significantly aid in monitoring injuries and facilitating a safe return to play for athletes. Here are some ways TMG can be beneficial in this context:\n\n### 1. **Objective Measurement of Muscle Recovery**\nTMG provides objective data regarding the contractile properties of muscles. By measuring metrics such as contraction time, relaxation time, and maximal displacement, practitioners can assess muscle function status. This is particularly useful during recovery from injuries, allowing for precise monitoring of healing progress.\n\n### 2. **Comparative Analysis of Injured vs. Healthy Muscles**\nIn a case study, TMG measurements revealed significant differences between the injured and healthy muscles of an athlete. For example, the time required for the injured muscle to contract was notably longer compared to the healthy muscle. Such insights facilitate informed decisions about the timing of returning to full training and competition.\n\n### 3. **Monitoring Asymmetry**\nTMG helps identify asymmetries in muscle function, which can indicate underlying issues that may lead to re-injury. Continuous assessments can be scheduled during recovery phases to ensure muscle symmetry is restored before returning to play. \n\n### 4. **Guiding Rehabilitation Programs**\nTMG's real-time feedback can optimize rehabilitation programs. By evaluating muscle function at different stages of recovery, rehabilitation specialists can tailor interventions to ensure that athletes are not returning too soon, thus minimizing the risk of re-injury.\n\n### 5. **Integration with Performance Monitoring**\nTMG data can be integrated with other performance metrics to provide a comprehensive view of an athlete's readiness for play. This holistic approach allows sports professionals to create safer and more effective return-to-play strategies.\n\n### Conclusion\nUtilizing TMG in injury monitoring offers a blend of scientific precision and practical application in the sports setting, making it an invaluable asset for coaches, physiotherapists, and sports professionals aiming to reduce the risk of re-injury during an athlete's return to play."  // [!code highlight]
  }
]
```

Considerations related to Markdown include:

- You are responsible for converting OpenAI's Markdown response to HTML.
- The Markdown-derived HTML needs to be sanitized, since it comes from a third-party source.
- You'll probably want to style the HTML, too—raw HTML looks ugly and likely won't match your site's styling.

I use `marked` for Markdown to HTML conversion, `DOMPurify` for HTML sanitization, and Tailwind Typography to style the HTML.

**TODO:** links to marked, DOMPurify, etc. pages.

The mechanics of the OpenAI Markdown response -> raw HTML -> sanitized, styled HTML look something like this:

```vue
<script setup>
// To convert OpenAI's Markdown responses to HTML
import { marked } from 'marked'

// To sanitize Markdown-derived HTML
import DOMPurify from 'dompurify'

// To ensure links to external hosts open in new tabs for better UX. See:
// - https://github.com/markedjs/marked/pull/1371#issuecomment-434320596
// - https://github.com/cure53/DOMPurify/issues/317#issuecomment-698800327
var renderer = new marked.Renderer();
renderer.link = function(href, title, text) {
  var link = marked.Renderer.prototype.link.apply(this, arguments);
  return link.replace("<a","<a target='_blank' rel='noopener noreferrer'");
};
marked.setOptions({
  renderer: renderer
});
DOMPurify.addHook('afterSanitizeAttributes', function (node) {
  if ('target' in node) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener');
  }
});

// An example Markdown message to convert to HTML
const markdownMessage = "Here is some Markdown:\n\n### 1. **Foo**\nLorem ipsum dolor sit amet\n\n### 2. **Bar**\nConsectetur adipiscing elit\n\n### 3. **Baz**\nsed do eiusmod tempor incididunt";
</script>

<template>
  <!-- Raw markdown must be first converted to HTML -->
  <!-- (with marked) and then sanitized (with DOMPurify) -->
  <!-- Markdown is styled using the `prose` class from Tailwind Typography -->
  <!-- See https://github.com/tailwindlabs/tailwindcss-typography -->
  <div v-html="DOMPurify.sanitize(marked.parse(markdownMessage))" class="prose"></div>
</template>
```

And here is a minimal decent-looking layout of an actual conversation (Warning: it uses Tailwind CSS!).
It renders messages in a column layout and styles the chatbot's and user's messages differently.

**TODO:** screenshot.

```vue
<script setup>
import { ref, } from 'vue'

// Conversation contains objects of the form
// { role: 'user', 'content': "Here is my question..." }
// { role: 'assistant', 'content': 'Here is my response...' }
const conversation = ref([])
</script>

<template>
  <!-- Thread messages -->
  <!-- Renders messages in a flex-column layout -->
  <!-- Updates automatically as the reactive variable `conversation` updates -->
  <!-- Chatbot's answers and user's prompts are styled differently -->
  <section v-if="conversation.length" class="flex flex-col gap-y-8">
    <div v-for="message in conversation" class="flex">
      <div class="-ml-2 flex-none rounded-full w-8 h-8" :class="message.role === 'assistant' ? 'bg-orange-500' : 'bg-blue-500'">
        <!-- Style chatbot responses with info icon -->
        <InformationCircleIcon v-if="message.role === 'assistant'" class="text-white" />
        <!-- Style user prompts with question icon -->
        <QuestionMarkCircleIcon v-else class="text-white" />
      </div>
      <div class="ml-2">
        <!-- Shows whose message is being displayed -->
        <p
          class="font-semibold"
          :class="message.role === 'assistant' ? 'text-orange-700' : 'text-blue-800'">
          {{message.role === "user" ? "You" : "Assistant"}}
        </p>

        <!-- The actual message content -->
        <!-- Raw markdown returned by OpenAI must be first converted to HTML -->
        <!-- (with marked) and then sanitized (with DOMPurify) -->
        <!-- The prose class from Tailwind Typography is used to style the markdown -->
        <!-- https://github.com/tailwindlabs/tailwindcss-typography -->
        <div v-html="DOMPurify.sanitize(marked.parse(message.content))" class="prose"></div>

      </div>
    </div>
  </section>
</template>
```

That's it, basically, as far as the plumbing and technical parts go.

The rest is frontend styling and customization, which will surely vary from case to case.

## Extras

### New chat

To start a new chat, you reset the `conversation` history, register a new conversationId, and clear the prompt; as a convenience to the user you can also focus the input/textarea where the user types the prompt:

```javascript
function newChat() {
  conversation.value = []
  conversationId.value = null
  registerConversation()
  prompt.value = "";
  promptInput.value.focus()
}
```

### Scroll to bottom

Here is minimal working code for a scroll-to-bottom button, like you see wit e.g. ChatGPT.
An scroll event listener takes care of hiding the button when the user scrolls to the bottom of the page.

```vue
<script setup>
// debounce prevents excessive updates when checking scroll position
import debounce from 'lodash/debounce';
import {ref } from 'vue'

// To hide scroll-to-bottom button when user is at bottom of page
// Debounce prevents excessive updates
const scrolledToBottom = ref(true)
window.addEventListener('scroll', debounce(function() {
  scrolledToBottom.value = ((window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight);
}, 50))
onMounted(() => {
  scrolledToBottom.value = ((window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight);
})

function scrollToBottom() {
  // Use both documentElement and body for browser cross-compatibility
  document.documentElement.scrollTop = document.documentElement.scrollHeight;
  document.body.scrollTop = document.body.scrollHeight;
  scrolledToBottom.value = true;
}
</script>

<template>
  <!-- Button is hidden when user scrolls to bottom of page -->
  <button v-if="!scrolledToBottom" @click="scrollToBottom" >
    Click me to scroll to bottom.
  </button>
</template>
```

### Resizing text area

It's convenient for the user to have the text area resize to accomodate the number of lines in their prompt, similar to what you have in commercial LLM chatbots.
I did this with the `useTextareaAutosize` utility from `@vueuse/core`; you can of course roll your own, too.

```vue
<script setup>
import { useTextareaAutosize } from '@vueuse/core'
  
const {
  textarea: myTextAreaRef,
  input: prompt
} = useTextareaAutosize()
</script>

<!-- Text area autoresizes to match number of lines in prompt -->
<textarea
  ref="myTextAreaRef"
  v-model="prompt"
  placeholder="Your question..."
  <!-- Makes Enter submit form, instead of inserting a new line -->
  @keydown.enter.exact.prevent="submit"
  <!-- Makes Shift+Enter insert a new line -->
  @keyup.shift.enter.exact.stop
  required
/>
```

## Extras

### Measurement videos

Chatbot is trained to respond to queries about the measurement process with a link to demo video page.

Videos processed and published [at a dedicated page](https://chat.tmg-bodyevolution.com/videos), where visitor can browse by muscle group.

[Example video](https://www.youtube.com/watch?v=0zXi15-FL7E)

### Publications

Chatbot is trained to respond to queries about the academic articles with a link to a publications page.

Academic articles processed and published [at a dedicated page](https://chat.tmg-bodyevolution.com/publications), where visitors can browse and search by keywords and authors.
