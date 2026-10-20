---
title: 'Seminar: Convergence of SGD in Non-Convex Optimization'
summary: 'Group seminar on convergence bounds for SGD with non-convex objectives.'
date: 2026-10-05
category: seminar
author: tran-minh-khoa
members: ['tran-minh-khoa', 'pham-quoc-anh']
tags: ['seminar', 'optimization']
---

**When:** 3:00 pm, 28/10/2026

**Where:** Athena meeting room (and online)

**Speaker:** Pham Quoc Anh, Athena Lab

**Abstract:** For an $L$-smooth non-convex objective, SGD with step size $\eta = \Theta(1/\sqrt{T})$ guarantees

$$
\min_{t \le T} \mathbb{E}\,\|\nabla f(x_t)\|^2 \;\le\; \frac{2\,(f(x_0) - f^\ast)}{\eta T} + \eta L \sigma^2 = \mathcal{O}\!\left(\frac{1}{\sqrt{T}}\right).
$$

The talk walks through the proof, the assumptions on gradient variance, and the extension to heterogeneous data in federated learning. Everyone interested is welcome.
