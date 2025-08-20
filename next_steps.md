# Blair AI v2.0 - Next Steps

## Immediate Priorities

### 1. Add User Assignment to Tasks
- Implement Notion user ID lookup functionality
- Create endpoint to fetch and cache user IDs from people_crm
- Update task creation to properly assign users using Notion Person type
- Map common names to Notion IDs (Kevin, Elizabeth, etc.)

### 2. Deploy Additional Agents
**Nora (Nutritionist)**
- Use same `meta.task` pattern for recipe/meal operations
- Connect to food_recipes, food_meal_plans databases
- Implement `recipe.create`, `meal_plan.generate` actions

**Oz (Order Taker)**
- Handle procurement through `order.create` actions
- Link to grocery lists and vendor management

**Sage (Scheduler)**
- Calendar integration via `event.create`, `event.update`
- Time blocking and conflict resolution

### 3. Enhance Error Handling
- Add detailed error messages for missing fields
- Implement retry logic for transient failures
- Better validation before Notion API calls

### 4. Testing & Monitoring
- Create comprehensive test suite for all actions
- Add performance monitoring (response times)
- Implement activity dashboard in Notion

## Architecture Decisions to Maintain

### The Meta Pattern (CRITICAL)
All ChatGPT/Claude agents MUST use this structure:
```json{
"agent": "agent_name",
"action": "resource.operation",
"idempotency_key": "uuid",
"meta": {
"user": "name",
"source": "chatgpt/claude",
"task": { /* for task operations / },
"project": { / for project operations / },
"filters": { / for search operations */ }
}
}

### Unified Endpoint Philosophy
- Keep single `/api/agent` endpoint for ALL operations
- Route internally based on action type
- This enables dynamic agent addition without API changes

## Known Issues & Solutions

### Issue: ChatGPT Field Restrictions
**Problem:** ChatGPT's OpenAPI implementation rejects unknown fields
**Solution:** Everything goes inside `meta` object with typed sub-objects

### Issue: Notion Field Types
**Problem:** Notion has strict typing (Person vs Text, etc.)
**Solution:** Map fields correctly in action handlers, validate before sending

### Issue: Database Field Naming
**Problem:** Inconsistent naming (title vs name, assignee types)
**Solution:** Handle both variations in code, document expected fields

## Future Enhancements

1. **Voice Integration**
   - Apple Shortcuts for Siri commands
   - Google Assistant support
   - Natural language processing improvements

2. **Multi-Agent Coordination**
   - Agent-to-agent communication protocol
   - Task handoff mechanisms
   - Shared context management

3. **Advanced Features**
   - Bulk operations support
   - Transaction rollback capability
   - Webhook notifications for task updates

## Development Guidelines

1. **Always test with Clark first** - CEO agent validates the pattern
2. **Document field mappings** - Critical for Notion integration
3. **Preserve unified architecture** - Don't create agent-specific endpoints
4. **Use meta pattern** - All data flows through meta object
5. **Handle backwards compatibility** - Support multiple field name variations

## Deployment Checklist
- [ ] Test all CRUD operations
- [ ] Verify idempotency handling
- [ ] Check error messages are helpful
- [ ] Confirm Railway logs are clean
- [ ] Update agent OpenAPI schemas
- [ ] Document any new Notion fields

Last Updated: January 2025
Status: Clark v2.0 Complete, Ready for Agent Expansion
