
기능 브랜치에서 작업하는 사이 `main`에 다른 사람의 커밋이 쌓여서, PR을 올리기 전에 최신 `main`을 반영해야 합니다. 누군가는 `git merge main`을 하라고 하고, 누군가는 `git rebase main`을 하라고 합니다.

둘 다 "내 브랜치에 `main`의 변경을 합친다"는 점은 같고, 코드 내용도 똑같이 끝날 수 있습니다. 다른 것은 **히스토리가 어떤 모양으로 남는가**이고, 이 차이는 협업에서 꽤 크게 작용합니다.

## 출발점

`main`에서 `feature` 브랜치를 만들고 커밋 두 개(`D`, `E`)를 했습니다. 그 사이 `main`에는 `C`가 추가됐습니다.

```text
          D---E   feature
         /
    A---B---C     main
```

## merge: 두 줄기를 잇는 커밋을 하나 만든다

```bash
git switch feature
git merge main
```

```text
          D---E---M   feature
         /       /
    A---B---C----     main
```

`M`은 부모가 두 개인 **병합 커밋**입니다. `D`와 `E`는 그대로 있습니다. 해시도, 작성 시각도 바뀌지 않습니다. 히스토리는 "실제로 일어난 일"을 그대로 기록합니다. 두 사람이 따로 작업했고, 어느 시점에 합쳤다는 사실까지 남습니다.

단점은 그래프가 복잡해진다는 것입니다. 기능 브랜치에서 `main`을 자주 받아 오면 `Merge branch 'main' into feature` 커밋이 여러 개 쌓이고, `git log --graph`가 여러 갈래로 얽힙니다.

## rebase: 내 커밋을 새 출발점 위에 다시 쌓는다

```bash
git switch feature
git rebase main
```

```text
              D'---E'   feature
             /
    A---B---C           main
```

`feature`가 마치 처음부터 `C`에서 갈라진 것처럼 보입니다. 병합 커밋이 없고 히스토리가 한 줄입니다.

그런데 그림에 `D`가 아니라 `D'`라고 적은 데에 이유가 있습니다.

## rebase는 커밋을 "옮기지" 않고 "새로 만듭니다"

Git의 커밋 해시는 커밋 내용, 작성자, 시각, 메시지, 그리고 **부모 커밋의 해시**까지 포함해 계산됩니다. `D`의 부모는 `B`였습니다. `C` 위에 올리려면 부모가 `C`인 커밋이 필요하고, 부모가 다르면 해시가 다른 별개의 커밋입니다.

그래서 rebase는 실제로 이런 일을 합니다.

1. `D`가 만든 변경(diff)을 `C` 위에 적용해서 새 커밋 `D'`를 만듭니다.
2. `E`의 변경을 `D'` 위에 적용해서 `E'`를 만듭니다.
3. `feature` 브랜치 이름을 `E'`로 옮깁니다.

`D'`와 `D`는 변경 내용과 메시지는 같지만 다른 커밋입니다. 원래의 `D`, `E`는 사라진 것이 아니라 아무 브랜치도 가리키지 않는 상태로 남습니다. 그래서 rebase를 잘못했을 때 되돌릴 수 있습니다.

```bash
git reflog                  # HEAD가 거쳐 간 커밋 기록
git reset --hard ORIG_HEAD  # rebase 직전 상태로 (rebase가 ORIG_HEAD를 남긴다)
```

`ORIG_HEAD`는 그 뒤에 다른 명령(`reset`, `merge` 등)이 덮어쓸 수 있으니, 시간이 지났다면 `git reflog`에서 rebase 전 커밋을 찾아 `git reset --hard <해시>`로 돌아갑니다.

"rebase는 커밋을 옮긴다"가 아니라 "새로 만든다"로 이해해야 다음 규칙이 왜 중요한지 와닿습니다.

## 공유 브랜치에서 rebase하면 안 되는 이유

동료가 내 `feature` 브랜치를 받아서 그 위에 커밋 `F`를 했다고 해 봅시다.

```text
동료의 저장소:   A---B---D---E---F
```

그 사이 나는 `feature`를 rebase하고 강제로 푸시했습니다.

```text
원격 저장소:     A---B---C---D'---E'
```

동료가 다시 받으면 Git은 `D`, `E`와 `D'`, `E'`가 같은 작업이라는 것을 알지 못합니다. 동료의 `D`, `E`, `F`와 원격의 `D'`, `E'`가 서로 다른 커밋 줄기로 보입니다. 그대로 `pull`하면 같은 변경이 두 벌씩 들어간 병합이 생기고, 이미 해결한 충돌을 다시 풀어야 할 수도 있습니다. 최악의 경우 강제 푸시가 동료가 먼저 올린 커밋을 덮어써서 지워 버립니다.

Pro Git 책은 이것을 한 문장의 규칙으로 적어 둡니다. 대략 이런 뜻입니다. **저장소 밖으로 내보내서 다른 사람이 그 위에 작업했을 수 있는 커밋은 rebase하지 마라.**

반대로 말하면, 아직 나만 쓰는 브랜치라면 rebase는 안전합니다. PR을 올렸더라도 그 브랜치에 커밋하는 사람이 나 혼자라면 팀 합의에 따라 rebase 후 강제 푸시를 하는 경우가 많습니다. `main`, `develop`처럼 여러 사람이 받아 가는 브랜치는 절대 rebase하지 않습니다.

## 강제 푸시는 --force-with-lease로

rebase한 브랜치를 이미 원격에 올린 적이 있다면 일반 `push`는 거절됩니다. 원격의 `E`가 내 `E'`의 조상이 아니기 때문입니다. 그래서 강제 푸시가 필요합니다.

```bash
git push --force-with-lease
```

`--force`는 원격 브랜치에 무엇이 있든 내 것으로 덮어씁니다. 그 사이 동료가 같은 브랜치에 푸시한 커밋이 있으면 그대로 사라집니다.

`--force-with-lease`는 "원격 브랜치가 **내가 마지막으로 알고 있던 상태**(로컬의 `origin/feature`)와 같을 때만" 덮어씁니다. 그 사이 누군가 푸시했다면 거절됩니다.

여기에도 함정이 하나 있습니다. "내가 마지막으로 알고 있던 상태"는 로컬의 원격 추적 브랜치(`origin/feature`)입니다. 푸시 전에 `git fetch`를 하면 동료의 커밋이 `origin/feature`에 반영되고, 나는 그걸 내 브랜치에 합치지 않았는데도 lease 확인은 통과합니다. 에디터가 백그라운드에서 자동으로 fetch하는 경우에도 같은 일이 생깁니다.

Git 2.30부터 들어간 `--force-if-includes`를 함께 쓰면, 원격 추적 브랜치의 커밋이 내 로컬 브랜치 기록에 포함되어 있는지까지 확인해서 이 문제를 막아 줍니다.

```bash
git push --force-with-lease --force-if-includes
```

자주 쓴다면 별칭을 만들어 둡니다.

```bash
git config --global alias.pushf "push --force-with-lease --force-if-includes"
```

## 충돌을 해결하는 방식의 차이

merge는 충돌을 **한 번에** 해결합니다. 양쪽의 최종 상태를 비교해서 충돌난 파일을 고치고, 병합 커밋 하나로 마무리합니다.

```bash
git merge main
# 충돌 파일 수정
git add .
git commit          # 병합 커밋 생성 (git merge --continue도 같다)
```

rebase는 커밋을 하나씩 다시 적용하므로 충돌도 **커밋마다** 생길 수 있습니다.

```bash
git rebase main
# D' 적용 중 충돌 -> 수정
git add .
git rebase --continue
# E' 적용 중 또 충돌 -> 수정
git add .
git rebase --continue
```

커밋이 많고, 같은 부분을 여러 커밋에서 고쳤다면 같은 곳의 충돌을 여러 번 해결해야 할 수 있습니다. 대신 각 충돌이 작은 범위라서 "이 커밋의 의도"를 생각하며 풀 수 있다는 장점도 있습니다.

도중에 상황이 꼬였다면 언제든 처음으로 돌아갈 수 있습니다.

```bash
git rebase --abort   # rebase 시작 전으로
git rebase --skip    # 지금 적용 중인 커밋을 버리고 다음으로 (신중하게)
```

같은 충돌을 반복해서 푸는 게 귀찮다면 `rerere`(reuse recorded resolution)를 켜 둘 수 있습니다. 한 번 해결한 충돌 모양을 기억했다가 같은 충돌이 다시 나오면 자동으로 적용합니다.

```bash
git config --global rerere.enabled true
```

## squash merge의 장단점

GitHub의 "Squash and merge"처럼, PR의 모든 커밋을 하나로 합쳐 `main`에 올리는 방식도 많이 씁니다. 명령으로는 이렇습니다.

```bash
git switch main
git merge --squash feature
git commit -m "feat: 검색 필터 추가"
```

장점은 분명합니다.

- `main`의 히스토리가 "PR 하나 = 커밋 하나"로 깔끔해집니다.
- `wip`, `오타 수정`, `리뷰 반영` 같은 커밋이 `main`에 남지 않습니다.
- 기능 하나를 되돌릴 때 커밋 하나만 `git revert`하면 됩니다.

단점도 있습니다.

- **커밋 단위 정보가 사라집니다.** 큰 PR을 하나로 뭉치면 `git bisect`로 버그를 찾을 때 "이 커밋 어딘가"까지만 좁혀지고, `git blame`도 커다란 커밋 하나를 가리킵니다.
- **원래 브랜치와 연결이 끊깁니다.** squash 커밋은 `feature`의 커밋들과 다른 새 커밋이라, Git은 `feature`가 합쳐졌다는 것을 모릅니다. `git branch -d feature`가 "완전히 병합되지 않았다"며 거절하고, `-D`로 지워야 합니다.
- **이어서 작업하면 꼬입니다.** squash된 브랜치 위에서 계속 작업하거나, 그 브랜치에서 갈라진 브랜치가 있다면 같은 변경이 두 번 적용된 것처럼 충돌이 납니다. squash merge 후에는 브랜치를 버리고 최신 `main`에서 새로 따는 것이 원칙입니다.

squash merge를 쓰는 팀이라면 PR을 작게 유지해야 합니다.

## 커밋을 정리하는 rebase

rebase는 다른 브랜치를 반영하는 것 말고 **내 커밋을 정리하는** 용도로도 씁니다. 리뷰 반영 커밋을 원래 커밋에 합치고 싶을 때는 `fixup` 커밋이 편합니다.

```bash
git commit --fixup <고칠 커밋의 해시>
git rebase -i --autosquash main
```

`--autosquash`는 `fixup!`으로 시작하는 커밋을 대상 커밋 바로 뒤에 `fixup` 동작으로 배치해 줍니다. 편집기에서 순서를 확인하고 저장하면 합쳐집니다. 이것도 커밋을 새로 만드는 일이니, 앞의 규칙(공유된 커밋은 건드리지 않는다)이 그대로 적용됩니다.

## 팀 규칙은 이렇게 정합니다

"rebase가 낫다", "merge가 낫다"는 정답이 있는 질문이 아닙니다. 팀이 히스토리에서 무엇을 얻고 싶은지에 따라 고르면 됩니다.

- **히스토리를 "실제로 일어난 일"의 기록으로 본다면** merge 위주가 맞습니다. 누가 언제 무엇을 합쳤는지 그대로 남습니다.
- **히스토리를 "읽기 좋은 변경 이야기"로 본다면** rebase와 squash가 맞습니다. `main`이 한 줄로 읽힙니다.

실무에서 흔히 쓰는 조합은 이렇습니다.

1. 자기 기능 브랜치에서 최신 `main`을 반영할 때는 rebase해도 됩니다. 단, 혼자 쓰는 브랜치일 때만입니다.
2. `main`, `develop` 같은 공유 브랜치는 절대 rebase하지 않고, 강제 푸시도 브랜치 보호 규칙으로 막습니다.
3. PR을 `main`에 합치는 방식은 하나로 정합니다(merge commit, squash, rebase 중 하나). GitHub 저장소 설정에서 허용할 방식만 켜 두면 실수가 줄어듭니다.
4. 강제 푸시가 필요하면 `--force-with-lease`를 씁니다.

`git pull`의 기본 동작도 맞춰 두면 좋습니다. 원격에 새 커밋이 있을 때 `pull`이 병합 커밋을 만들지, 내 로컬 커밋을 위로 다시 쌓을지를 정하는 설정입니다.

```bash
git config --global pull.rebase true   # pull할 때 rebase
# 또는
git config --global pull.ff only       # fast-forward가 안 되면 멈추고 직접 고르게
```

어떤 규칙을 고르든, 팀원 모두가 같은 규칙을 알고 있어야 합니다. README나 기여 가이드에 몇 줄로 적어 두세요.

## 참고

- [Pro Git - Git Branching: Rebasing](https://git-scm.com/book/en/v2/Git-Branching-Rebasing)
- [Git 문서 - git-rebase](https://git-scm.com/docs/git-rebase)
- [Git 문서 - git-push](https://git-scm.com/docs/git-push)
- [Git 문서 - git-rerere](https://git-scm.com/docs/git-rerere)
- [GitHub Docs - About merge methods on GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/about-merge-methods-on-github)
