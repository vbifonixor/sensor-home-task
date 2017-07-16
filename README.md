# Воркшоп "Сенсорные события". Мобилизация 2017

Для запуска мастер класс необходимо операционная система на базе unix или windows 10 с последним обновлением (Creators Update) с включенным "Bash Ubuntu for Windows" [Подробнее](https://www.windowscentral.com/how-install-bash-shell-command-line-windows-10)

## Первый запуск
```bash
npm install
npm run watch
```

## Полезные материалы:
- Touch Events https://developer.mozilla.org/en-US/docs/Web/API/Touch_events
- Pointer Events https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
- Видео о сенсорных событиях с ШРИ 2016 https://www.youtube.com/watch?v=VZAcd2svW7w
- Более подробный разбор Pointer Events https://www.youtube.com/watch?v=JxTiGnvwxHA
- Примеры из последнего доклада https://github.com/vsesh/pointer-events-examples

## Домашнее задание
### Задачи
- Необходимо поддержкать в EventManager события спецификации Pointer Events
- Необходимо поддержкать в EventManager поддержать события "колесико мышки"
- Необходимо придумать и реализовать поведение "OneTouchZoom" (down, up, down, move ↑↓). Изменение масштаба одним пальцем. Это поведение должно работать только с пальцами (!), не с мышкой. Изображение должно зумироваться в точку таба.
- Пишем на Vanilla JS. Не используем полифилы.
- Поддерживаемые браузеры: IE11, Edge, Chrome (+ Android Chrome), Firefox, iOS Safari, Safari

### Необходимо обратить внимание
- Соблюдение текущей архитектуры приложения
- Учесть различия между Pointer Events и Touch Events
- Учесть, что в одном браузере может поддержка нескольких спецификаций
- Работу событий за пределами элемента
- Стандартное поведение браузера

## Контакты
- Присылайте домашнее задание по адресу vsesh@yandex-team.ru
- Заголовок письма должен быть "Домашнее задание ШРИ, <Фамилия> <Имя>"
- Присылаем файлы всего проекта, который можно сразу запустить. Или ссылку на уже собранный проект, в котором исходиники не обфусцированы.
- Дедлайн - 18 июля 23.00
- Меня можно найти еще в телеграме @vsesh

## Pointer Events
- Pointer Events на caniuse http://caniuse.com/#search=pointer
- Pointer Events работает из коробки в Edge/IE11 и Google Chrome (Window, Mac, Android)
- Виртуальную машину с образами Windows с Edge/IE можно скачать - https://developer.microsoft.com/en-us/microsoft-edge/tools/vms/
- Для отладки нескольких PointerEvent событий в Chrome под Mac можно попробовать использовать эту мелкую библиотеку https://github.com/vsesh/mouseToMultiPointer
