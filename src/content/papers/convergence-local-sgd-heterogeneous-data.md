---
title: 'Convergence of Local SGD under Heterogeneous Data'
date: 2026-01-20
authors: ['pham-quoc-anh', 'tran-minh-khoa', 'Elena Rossi']
venue: 'Proceedings of the 40th AAAI Conference on Artificial Intelligence'
venue_short: 'AAAI 2026'
type: conference
status: published
links:
  arxiv: https://arxiv.org/abs/2601.00001
  pdf: https://example.org/papers/local-sgd.pdf
  code: https://github.com/example-athena/local-sgd
bibtex: |
  @inproceedings{pham2026localsgd,
    title     = {Convergence of Local SGD under Heterogeneous Data},
    author    = {Pham, Quoc Anh and Tran, Minh Khoa and Rossi, Elena},
    booktitle = {Proceedings of the 40th AAAI Conference on Artificial Intelligence},
    year      = {2026}
  }
tags: ['tối ưu hoá', 'học liên kết']
projects: ['open-science-toolkit']
featured: true
---

**Tóm tắt.** Chúng tôi phân tích Local SGD khi dữ liệu giữa các máy khách không đồng nhất. Với hàm mục tiêu $L$-trơn và độ lệch gradient bị chặn bởi $\zeta^2$, ta chứng minh sau $T$ vòng giao tiếp thuật toán đạt $\mathbb{E}\|\nabla f(\bar{x}_T)\|^2 \le \mathcal{O}\!\left(\tfrac{1}{\sqrt{KT}} + \tfrac{\zeta^2}{T}\right)$, cải thiện số hạng phụ thuộc vào độ không đồng nhất so với các kết quả trước đó.
