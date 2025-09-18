# AWS Step Functions – Lab DIO (Workflow: validar → processar → persistir → notificar)

**Autora:** Fiama  
**Curso:** Gestão de T.I. (Anhanguera) • **Empresa:** Contrei (Auxiliar de Contratos)  

Este repositório consolida meu laboratório de **orquestração serverless** com **AWS Step Functions**, integrando **AWS Lambda**, **DynamoDB** e **SNS**. O fluxo valida a entrada, processa dados em paralelo, persiste no banco e envia uma notificação no final.

> **Região usada:** `sa-east-1` (São Paulo)  
> **State Machine:** `dio-lab-workflow`  

---

## 🧭 Sumário
- [Arquitetura](#arquitetura)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Pré-requisitos](#pré-requisitos)
- [Deploy (SAM)](#deploy-sam)
- [Executar o workflow](#executar-o-workflow)
- [Validar resultados (DynamoDB e SNS)](#validar-resultados-dynamodb-e-sns)
- [Personalizações úteis](#personalizações-úteis)
- [Problemas comuns (Troubleshooting)](#problemas-comuns-troubleshooting)
- [Licença](#licença)

---

## Arquitetura

```powershell
┌─────────────┐      ┌──────────────────────┐
│ API/CLI/GUI │ ───▶ │ Step Functions (ASL) │
└─────┬───────┘      └──────────┬───────────┘
      │                          │
      │               ┌──────────▼───────────┐
      │               │ Lambda: Validate     │
      │               └──────────┬───────────┘
      │                          │ Choice
      │               ┌──────────▼──────────┐
      │               │ ParallelProcessing   │
      │               ├───────┬──────────────┤
      │               │       │              │
      │          ┌────▼───┐ ┌─▼────┐        │
      │          │Lambda  │ │Dynamo│ putItem │
      │          │Process │ │(DDB) │        │
      │          └────────┘ └──────┘        │
      │                          │
      │               ┌──────────▼───────────┐
      │               │ SNS: Notificar       │
      │               └──────────────────────┘

```
**Pontos-chave**
- **Retries** no processamento (erros transitórios de Lambda).  
- **Persistência** no DynamoDB com `id` (requestId), `status` e `ts`.  
- **Notificação** via SNS (mensagem com o contexto da execução).

---

## Estrutura do repositório
```powershell
├── README.md
├── template.yaml 
├── state-machines/
│ └── example.asl.json 
├── lambdas/
│ ├── validate_input/
│ │ └── index.js
│ ├── process_item/
│ │ └── index.js
│ └── notify_user/
│ └── index.js
├── images/ 
└── docs/
```

---

## Pré-requisitos

- **Conta AWS** com permissões para: IAM Roles, Lambda, Step Functions, DynamoDB, SNS.  
- **AWS CLI 2.x** configurada (`aws configure`).  
- **AWS SAM CLI** instalado.  
- **Node.js** (18 ou 20) + **npm** no PATH (ou use `sam build --use-container`).  
- **Região padrão** (recomendado): `sa-east-1`.

> **Windows (PowerShell):** se tiver erro com aspas JSON, veja a seção de [Troubleshooting](#problemas-comuns-troubleshooting).

---

## Deploy (SAM)

Na raiz do projeto:

```powershell
sam build
sam deploy --guided --template-file .\template.yaml
```

**Responda:**

- **Stack Name:** ```dio-aws-stepfunctions-lab-fiama```

- **Region:** ```sa-east-1```

- **Confirm changes:** ```Y```

- **Allow SAM CLI IAM role creation:** ```Y```

- **Save arguments to samconfig.toml:** ```Y```

Ao final, o SAM mostra Outputs como:

- ```TableName```

- ```TopicArn```

- ```ProcessItemFunctionArn```

- ```ValidateInputFunctionArn```

- ```NotifyUserFunctionArn```

- ```StateMachineArn``` ← use para iniciar execuções

---

## Executar o workflow
**Pelo Console (mais simples)**

**Step Functions →** ```dio-lab-workflow``` **→ Start execution**

- **Input:**
```{ "requestId": "REQ-123" }```

- Start e veja o **Graph**.

## **Pela CLI (CMD do Windows – evita treta de aspas)**

```aws stepfunctions start-execution --cli-binary-format raw-in-base64-out --region sa-east-1 --state-machine-arn <COLE_A_ARN> --input "{\"requestId\":\"REQ-123\"}"```

>Para verificar:
>
>```aws stepfunctions list-executions --region sa-east-1 --state-machine-arn <ARN> --max-results 1 --output table```

---

## **Validar resultados (DynamoDB e SNS)**

**DynamoDB**

- **DynamoDB → Tables →** ```dio-lab-items``` **→ Explore table items**

- Item esperado:
```
{
  "id": "REQ-123",
  "status": "PROCESSED",
  "ts": "2025-09-18T00:17:52Z"   // exemplo
}
```
**SNS (e-mail)**

**1- SNS → Topics →** ```dio-lab-topic``` **→ Create subscription** -

   - Protocol: **Email** | Endpoint: seu e-mail

**2-** Confirme o e-mail recebido.

**3-** Rode outra execução: você receberá uma mensagem com o contexto.

---

## Personalizações úteis
**1) Assunto e mensagem amigável no SNS**

No estado ```NotifyUser``` do ```example.asl.json```:
```
"NotifyUser": {
  "Type": "Task",
  "Resource": "arn:aws:states:::sns:publish",
  "Parameters": {
    "TopicArn": "${SnsTopicArn}",
    "Subject": "DIO Lab – Execução concluída",
    "Message.$": "States.Format('Workflow OK. requestId={} status={}', $.validation.Payload.requestId, 'PROCESSED')"
  },
  "End": true
}
```

**2) Remover metadados de invocação do retorno das Lambdas**

Use ```ResultSelector```:
```
"ValidateInput": {
  "Type": "Task",
  "Resource": "arn:aws:states:::lambda:invoke",
  "Parameters": { "FunctionName": "${ValidateInputLambda}", "Payload.$": "$" },
  "ResultSelector": { "Payload.$": "$.Payload" },
  "ResultPath": "$.validation",
  "Next": "IsValid"
}
```
(Repita o padrão em ```ProcessItem``` se quiser.)

---

## Problemas comuns (Troubleshooting)

- **JSON no PowerShell (“Unexpected character 'r'” / “expecting double-quote”)**

    Use **CMD** com ```--cli-binary-format raw-in-base64-out``` **ou** gere o JSON via PowerShell:
```
$inputObj = @{ requestId = "REQ-123" } | ConvertTo-Json -Compress
aws stepfunctions start-execution --cli-binary-format raw-in-base64-out --region sa-east-1 --state-machine-arn <ARN> --input $inputObj
```

- **Stack em** ```ROLLBACK_COMPLETE```
Delete e faça deploy de novo:
```
aws cloudformation delete-stack --stack-name dio-aws-stepfunctions-lab-fiama --region sa-east-1
aws cloudformation wait stack-delete-complete --stack-name dio-aws-stepfunctions-lab-fiama --region sa-east-1
sam deploy --guided --template-file .\template.yaml
```

- ```SCHEMA_VALIDATION_FAILED``` **no DDB** ```putItem```
  
Use ```S.$``` com **JSONPath válido:**
```
"ts": { "S.$": "$$.State.EnteredTime" }
```

- ```sam build``` **falha pedindo** ```npm```

Instale o **Node.js LTS** (inclui ```npm```) ou use container: ```sam build --use-container```.

- ```PermissionError ... AWS SAM\metadata.json``` (Windows)
  
Execute o PowerShell **como Administrador**  . Se necessário, crie o arquivo:
```
New-Item -ItemType Directory -Path "$env:APPDATA\AWS SAM" -Force | Out-Null
'{}' | Out-File "$env:APPDATA\AWS SAM\metadata.json" -Encoding utf8
```
---

## 👩‍💻 Autora
**Fiama Ribeiro**  
Estudante de Gestão de TI • Bootcamp DIO • Entusiasta de Cloud Computing ☁️  

---

## 🧾 Licença
Distribuído sob a licença **MIT**. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

> Observação: este projeto é educacional (DIO). Custos mínimos podem ocorrer na AWS (ex.: DynamoDB/SNS). Lembre-se de **excluir os recursos** após os testes se não for manter.


