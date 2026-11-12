


def combat_training_plan_payload(plan):
    return {
        **(plan.data or {}),
        "id": plan.id,
        "title": plan.title,
        "layout": plan.layout,
        "createdAt": plan.created_at.isoformat(),
        "updatedAt": plan.updated_at.isoformat(),
        "publishedAt": plan.published_at.isoformat() if plan.published_at else None,
    }
