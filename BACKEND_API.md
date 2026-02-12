# 双色球前端对接接口说明

前端通过环境变量 `VITE_API_BASE_URL` 访问后端，未配置时使用：

`http://localhost:8080/api`

可参考项目根目录的 `env.example`，复制为你本地的 `.env` 后修改：

```bash
cp env.example .env
```

同时支持 `VITE_BASE_PATH` 用于部署子路径（例如 GitHub Pages）。

---

## 1) 首页预测结果接口

- 方法：`GET`
- 路径：`/ssq/predictions/latest`
- 完整示例：`http://localhost:8080/api/ssq/predictions/latest`

### 响应（推荐）

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "latestDrawIssue": "2026018",
    "predictTime": "2026-02-12 10:00:00",
    "strategies": [
      {
        "id": "hot-cold-v1",
        "name": "冷热号组合",
        "featureSet": ["hot", "cold", "oddEven"],
        "red": [1, 7, 12, 19, 28, 33],
        "blue": 9,
        "confidence": 0.71
      }
    ]
  }
}
```

### 字段要求

- `latestDrawIssue`: 最新已开奖期号，字符串（首页展示使用）。
- `predictTime`: 预测生成时间，字符串。
- `strategies`: 预测策略列表（至少 1 条）。
- `strategies[].name`: 策略名。
- `strategies[].featureSet`: 特征组合数组。
- `strategies[].red`: 红球数组（6 个数字）。
- `strategies[].blue`: 蓝球数字（1 个数字）。
- `strategies[].confidence`: 0~1 的小数，可选。
- `issue`/`latestIssue`: 兼容旧字段，可选；建议统一为 `latestDrawIssue`。

> 兼容说明：前端也兼容返回不带 `data` 的扁平结构。

---

## 2) 历史开奖接口

- 方法：`GET`
- 路径：`/ssq/history`
- Query 参数：
  - `pageNo`: 页码（默认 1）
  - `pageSize`: 每页条数（默认 20，建议 <= 50）
- 完整示例：`http://localhost:8080/api/ssq/history?pageNo=1&pageSize=20`

### 响应（参考 `ssq.md`）

```json
{
  "state": 0,
  "message": "查询成功",
  "total": 1976,
  "pageNo": 1,
  "pageSize": 20,
  "result": [
    {
      "name": "双色球",
      "code": "2026018",
      "date": "2026-02-10(二)",
      "red": "11,15,17,22,25,30",
      "blue": "07",
      "sales": "365733450",
      "poolmoney": "2751368081",
      "content": "内蒙古1注，上海1注...",
      "prizegrades": [
        { "type": 1, "typenum": "6", "typemoney": "5577851" },
        { "type": 2, "typenum": "82", "typemoney": "169127" }
      ]
    }
  ]
}
```

### 字段要求

- `total`: 总记录数。
- `result`: 开奖列表，按期号倒序（最新在前）。
- `result[].code/date/red/blue/content`: 历史页主列表展示字段。
- `result[].sales/poolmoney/prizegrades`: 历史页手风琴中的扩展信息。

---

## 3) 错误响应建议

统一返回：

```json
{
  "code": 500,
  "message": "error message"
}
```

HTTP 状态码建议：

- 参数错误：`400`
- 服务异常：`500`
